import 'cypress-iframe';

describe('XPay BAFL End-to-End Credit Card Payment and Verification Flow', () => {
  const portalUrl = 'https://xpay-app-stage.postexglobal.com/';
  const paymentUrl = 'https://js.xstak.com/react-stage/index.html';

  // --- Step 1: Login to Portal and Enable BAFL Gateway ---
  before(() => {
    cy.visit(portalUrl);

    cy.get('input[name="account_id"]').should('be.visible').type('0ddb82950784f875');
    cy.get('input[name="email"]').should('be.visible').type('aima.rauf@shopdev.co');
    cy.get('input[name="password"]').should('be.visible').type('Aima123!');
    cy.contains('button', 'Login').should('be.visible').click();

    cy.intercept('GET', '**/users/me').as('getUser');
    cy.wait('@getUser', { timeout: 30000 });
    cy.contains('Settings', { timeout: 30000 }).should('be.visible');
    cy.log('✅ Logged in successfully and dashboard loaded');
  });

  const selectStore = (storeName) => {
    cy.get('.selectStore .ant-select-selector').click();
    cy.get('.rc-virtual-list .ant-select-item-option')
      .contains(storeName)
      .click({ force: true });
    cy.get('.selectStore .ant-select-selection-item')
      .should('have.text', storeName);
  };

  const goToGateways = () => {
    cy.contains('Settings').click();
    cy.contains('Gateways').click();
  };

  it('should enable BAFL Test Gateway, perform Credit Card Payment, and verify transaction', () => {
    // --- Step 2: Enable BAFL Gateway ---
    selectStore('GPay Stage Testing');
    goToGateways();

    cy.contains('td.ant-table-cell', 'BAFL Test')
      .parent('tr')
      .find('div.table-action-btn')
      .contains('Edit')
      .click();

    cy.get('.GatewayModal').should('be.visible');
    let updateNeeded = false;

    cy.get('#disabled').then(($btns) => {
      const visibleBtns = $btns.filter(':visible');
      visibleBtns.each((_, btn) => {
        const isEnabled = btn.getAttribute('aria-checked') === 'true';
        if (!isEnabled) {
          cy.wrap(btn).click();
          updateNeeded = true;
          cy.log('✅ Gateway enabled');
        }
      });
    });

    cy.get('body').then(($body) => {
      if ($body.find('#isDefault').length > 0) {
        const $btns = $body.find('#isDefault:visible');
        $btns.each((_, btn) => {
          const isDefault = btn.getAttribute('aria-checked') === 'true';
          if (!isDefault) {
            cy.wrap(btn).click();
            updateNeeded = true;
            cy.log('✅ Default toggle turned ON');
          }
        });
      }
    });

    cy.then(() => {
      if (updateNeeded) {
        cy.get('.GatewayModal').contains('button', 'Update').click();
        cy.log('✅ Gateway updated');
      } else {
        cy.log('ℹ️ No changes needed');
      }
    });

    // --- Step 3: Visit Payment Page ---
    cy.visit(paymentUrl);
    cy.log('🧭 Navigated to Payment Page');

    // --- Step 4: Handle Credit Card Payment inside iframe ---
    cy.get('iframe', { timeout: 40000 }).should('exist').then(($iframes) => {
      const matched = [...$iframes].filter((iframe) =>
        iframe.src.includes('v4/core-stage')
      );
      if (matched.length === 0) throw new Error('❌ No payment iframe found.');
      cy.wrap(matched[0]).as('paymentFrame');
    });

    cy.get('@paymentFrame').then(($iframe) => {
      const iframeSelector = `iframe[src="${$iframe.attr('src')}"]`;
      cy.frameLoaded(iframeSelector);
      cy.iframe(iframeSelector).within(() => {
        cy.get('input[name="creditCard"]').should('be.visible').clear().type('5123 4500 0000 0008');
        cy.get('input[name="exp"]').clear().type('0139');
        cy.get('input[name="cvc"]').clear().type('100');
      });
    });

    cy.contains('button', 'Pay Now', { timeout: 20000 }).click({ force: true });

    // --- Step 5: Handle 3DS Authentication ---
    cy.wait(5000);
    cy.get('iframe', { timeout: 20000 }).then(($iframes) => {
      const threeDSFrame = [...$iframes].find(
        (f) =>
          f.src.includes('acs') ||
          f.src.includes('3ds') ||
          f.src.includes('mastercard') ||
          f.id === '3ds-iframe'
      );
      if (threeDSFrame) {
        const selector = `iframe[src="${threeDSFrame.src}"]`;
        cy.frameLoaded(selector, { timeout: 20000 });
        cy.iframe(selector).within(() => {
          cy.wait(2000);
          cy.get('select, #selectAuthResult', { timeout: 10000 })
            .first()
            .select('AUTHENTICATED', { force: true });
          cy.get('button, input[type="submit"], input[value="Submit"]').first().click({ force: true });
        });
      } else {
        cy.log('💨 No 3DS iframe detected — frictionless authentication.');
      }
    });

    cy.wait(8000);
    cy.log('✅ Credit Card payment completed');

    // --- Step 6: Verify Transaction in Portal ---
    cy.visit(portalUrl);
    cy.get('a[href="/transactions"]').should('be.visible');

    selectStore('GPay Stage Testing');
    cy.wait(2000);
    cy.get('a[href="/transactions"]').click();
    cy.wait(2000);

    cy.get('table tbody tr').first().click();
    cy.wait(2000);

    // --- Step 7: Verify Payment Details ---
    cy.get('.transaction-details').within(() => {
      const paymentFields = [
        'Transaction Id',
        'Payment Status',
        'Payment Link',
        'Intent Id',
        'Order Source',
        'Order Amount',
        'Discounted Amount',
        'Refunded Amount',
        'Payment Method Type',
        'Payment Response Status',
        'Payment Response Message',
        'Payment Response Code',
        'Gateway',
        'Creation Time',
        'Last Update Time',
        'Card Fingerprint'
      ];

      cy.get('.Payment-Details', { timeout: 10000 }).within(() => {
        paymentFields.forEach((field) => {
          cy.contains('h2', field).siblings('span').should('exist');
        });
      });
    });

    // --- Step 8: Verify Customer Details ---
    cy.get('.detail-card').each(($card) => {
      if ($card.text().includes('Customer Name') && $card.text().includes('Email')) {
        cy.wrap($card).within(() => {
          const customerFields = [
            'Customer Name',
            'Email',
            'Phone Number',
            'IP Address 1',
            'IP Address 2'
          ];
          customerFields.forEach((field) => {
            cy.contains('h2', field).siblings('span').should('exist');
          });
        });
      }
    });

    // --- Step 9: Verify Shipping Details ---
    cy.get('.detail-card').each(($card) => {
      if ($card.text().includes('Address 1') && $card.text().includes('ZIP')) {
        cy.wrap($card).within(() => {
          const shippingFields = [
            'Customer Name',
            'Phone Number',
            'Address 1',
            'Address 2',
            'ZIP Code',
            'City',
            'Province',
            'Country'
          ];
          shippingFields.forEach((field) => {
            cy.contains('h2', new RegExp(field, 'i')).siblings('span').should('exist');
          });
        });
      }
    });

    // --- Step 10: Verify Billing Details ---
    cy.get('.detail-card').each(($card) => {
      if ($card.text().includes('Billing') || $card.text().includes('ZIP Code')) {
        cy.wrap($card).within(() => {
          const billingFields = [
            'Customer Name',
            'Phone Number',
            'Address 1',
            'Address 2',
            'ZIP Code',
            'City',
            'Province',
            'Country'
          ];
          billingFields.forEach((field) => {
            cy.contains('h2', new RegExp(field, 'i')).siblings('span').should('exist');
          });
        });
      }
    });


    // Verify Card Details
cy.get('.detail-card').each(($card) => {
  // Only process cards that actually contain credit card info
  if ($card.text().includes('Terminal Id') || $card.text().includes('Card Number')) {
    cy.wrap($card).within(() => {
      const cardFields = [
        'Name',
        'Card Number',
        'Funding Method',
        'Card Type',
        'Authorization Code',
        'Card Version',
        'Card Issuer',
        'Card Network',
        'Amount',
        'Terminal Id'
      ];

      cardFields.forEach((field) => {
        cy.contains('h2', new RegExp(field, 'i')).siblings('span').then(($span) => {
          if ($span.find('img').length > 0) {
            cy.wrap($span)
              .find('img')
              .should('have.attr', 'src')
              .and('match', /mastercard|visa|jazzcash/i);
          } else {
            cy.wrap($span).invoke('text').then((text) => {
              cy.log(`${field}: ${text.trim()}`);
              expect(text.trim()).to.not.be.empty;
            });
          }
        });
      });
    });
  }
});




    // --- Step 11: Verify Timeline ---
   // Loop through all timeline items
cy.get('.ant-timeline-item-content').each(($item) => {
  cy.wrap($item).within(() => {
    cy.get('p span').first().invoke('text').then((status) => {
      cy.log('Timeline status: ' + status);
      expect(status.trim()).to.not.be.empty;
    });

    cy.get('p').last().invoke('text').then((timestamp) => {
      cy.log('Timeline timestamp: ' + timestamp);
      // Optional: validate date format like Nov 11, 2025 2:26:29 PM
      expect(timestamp.trim()).to.match(/\w{3}\s\d{1,2},\s\d{4}\s\d{1,2}:\d{2}:\d{2}\s[AP]M/);
    });
  });
});


    // --- Step 12: Verify Refund Details ---
    cy.get('.detail-card').last().within(() => {
      const refundFields = ['Order ID', 'Paid Amount', 'Refunded Amount', 'Currency'];
      refundFields.forEach((field) => {
        cy.contains('h2', field).siblings('span').should('exist');
      });
    });

    cy.log('✅ Transaction verified successfully across all sections.');
  });
});
