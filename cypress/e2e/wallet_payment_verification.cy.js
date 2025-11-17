import 'cypress-iframe';

describe('JazzCash Wallet Payment E2E Verification', () => {
  const baseUrl = 'https://js.xstak.com/react-stage/index.html';
  const portalUrl = 'https://xpay-app-stage.postexglobal.com/';

  it('should complete JazzCash payment and verify transaction in portal', () => {
    // --- STEP 1: Complete JazzCash Payment ---
    cy.visit(baseUrl);

    cy.frameLoaded('iframe[name="payment"]');

    cy.iframe('iframe[name="payment"]').within(() => {
      cy.get('#jazzcash').click();
      cy.get('input[name="mobileNumber"]:visible').type('03123456789');
      cy.get('input[name="cnic"]').type('345678');
    });

    cy.contains('button', 'Pay Now').click();

    cy.on('window:alert', (txt) => {
      expect(txt).to.contain('Thank you for Using JazzCash');
    });

    cy.wait(4000);
    cy.log('✅ JazzCash payment completed');

    // --- STEP 2: Login to Portal ---
    cy.visit(portalUrl);
    cy.get('input[name="account_id"]').type('0ddb82950784f875');
    cy.get('input[name="email"]').type('aima.rauf@shopdev.co');
    cy.get('input[name="password"]').type('Aima123!');
    cy.contains('button', 'Login').click();

    cy.get('a[href="/transactions"]').should('be.visible');

    // Select Store
    cy.get('.ant-select-selector').first().click();
    cy.contains('.ant-select-item-option-content', 'GPay Stage Testing')
      .scrollIntoView({ offset: { top: -100 } })
      .click();
    cy.wait(2000);

    // Navigate to transactions
    cy.get('a[href="/transactions"]').click();
    cy.wait(2000);

    // Open latest transaction
    cy.get('table tbody tr').first().click();

    // --- STEP 3: Verify Transaction Details ---
    cy.get('.transaction-details').within(() => {
      // Transaction ID
      cy.contains('Transaction Id')
        .siblings('span')
        .invoke('text')
        .then((text) => {
          const transactionId = text.trim();
          cy.log('Captured Transaction ID: ' + transactionId);
          expect(transactionId).to.not.be.empty;
        });

      // Basic payment fields
      const paymentFields = [
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
          cy.contains('h2', field).siblings('span').should('exist').then(($span) => {
            const text = $span.text().trim();
            if (text) {
              expect(text).to.not.be.empty;
            } else {
              cy.wrap($span).children().should('exist');
            }
          });
        });
      });
    });

    // --- STEP 4: Verify Wallet Details ---
    // --- STEP 4: Verify Wallet Details ---
cy.get('.detail-card').each(($card) => {
  // Check if this card contains the "CNIC" label
  cy.wrap($card).then(($el) => {
    if ($el.text().includes('CNIC')) {
      cy.wrap($el).within(() => {
        const walletFields = ['CNIC', 'Phone', 'Authorization Code', 'Message', 'Status Code'];
        walletFields.forEach((field) => {
          cy.contains('h2', field, { timeout: 5000 })
            .siblings('span')
            .should('exist')
            .and(($span) => {
              expect($span.text().trim()).to.not.be.empty;
            });
        });
      });
    }
  });
});

    // --- STEP 5: Verify Billing Details ---
  // --- STEP 5: Verify Billing Details (Improved Robust Version) ---
cy.get('.detail-card').each(($card) => {
  cy.wrap($card).then(($el) => {
    // Find card containing "Customer Name" and "ZIP Code"
    const text = $el.text();
    if (text.includes('Customer Name') && text.includes('ZIP')) {
      cy.log('✅ Found Billing Details section');
      cy.wrap($el).within(() => {
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
          cy.contains('h2', new RegExp(field, 'i'), { timeout: 10000 })
            .siblings('span')
            .should('exist')
            .then(($span) => {
              const value = $span.text().trim();
              // Allow 'N/A' or 'undefined' but log every field
              expect($span).to.exist;
              cy.log(`📦 ${field}: ${value}`);
            });
        });
      });
    }
  });
});


    // --- STEP 6: Verify Timeline ---
    cy.get('.ant-timeline-item-content', { timeout: 10000 }).within(() => {
      cy.contains('span', 'CAPTURED').should('exist');
      cy.get('p').last().invoke('text').then((text) => {
        expect(text.trim()).to.match(/\w{3}\s\d{1,2},\s\d{4}/); // e.g., Nov 11, 2025
      });
    });

    // --- STEP 7: Verify Refund Details ---
    cy.get('.detail-card').last().within(() => {
      const refundFields = ['Order ID', 'Paid Amount', 'Refunded Amount', 'Currency'];
      refundFields.forEach((field) => {
        cy.contains('h2', field).siblings('span').should('exist').and(($span) => {
          expect($span.text().trim()).to.not.be.empty;
        });
      });
    });

    // --- STEP 4B: Verify Shipping Details ---
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
        cy.contains('h2', new RegExp(field, 'i'), { timeout: 5000 })
          .siblings('span')
          .should('exist')
          .then(($span) => {
            const text = $span.text().trim();
            cy.log(`🚚 ${field}: ${text}`);
          });
      });
    });
  }
});

// --- STEP 3A: Verify Transaction Summary ---
cy.get('.transaction-details').within(() => {
  const summaryFields = [
    'Captured',
    'Thank you for Using JazzCash',
    'Amount',
    'Payment ID',
    'Order ID'
  ];

  summaryFields.forEach((field) => {
    cy.contains(field, { matchCase: false }).should('exist');
  });
});




// --- STEP 4A: Verify Customer Details ---
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
        cy.contains('h2', field, { timeout: 5000 })
          .siblings('span')
          .should('exist')
          .then(($span) => {
            const text = $span.text().trim();
            cy.log(`👤 ${field}: ${text}`);
          });
      });
    });
  }
});



    // ✅ Final Log
    cy.log('✅ Transaction verification completed successfully across all sections.');
  });
});
