import 'cypress-iframe';
import 'cypress-wait-until';

describe('XPay Payment Flow with BAFL 3DS Challenge', () => {

   // Ignore uncaught exceptions from the app (like postMessage)
  Cypress.on('uncaught:exception', (err) => {
    console.warn('💡 Ignored uncaught exception:', err.message);
    return false;
  });
  const payer = {
    email: 'xyz@gmail.com',
    customerName: 'xyz',
    creditCard: '5123 4500 0000 0008',
    exp: '01/39',
    cvc: '100',
  };

  it('should complete BAFL 3DS payment flow successfully', () => {
    cy.visit('https://xpay-app-stage.postexglobal.com/');

    // --- Login ---
    cy.get('input[name="email"]').type('aima.rauf@shopdev.co');
    cy.get('input[name="account_id"]').type('0ddb82950784f875');
    cy.get('input[name="password"]').type('Aima123!');
    cy.contains('button', 'Login').click();
    cy.url().should('include', '/dashboard');

    // --- Select store ---
    cy.get('.selectStore .ant-select-selector').click();
    cy.get('.rc-virtual-list .ant-select-item-option')
      .contains('GPay Stage Testing')
      .click({ force: true });

    // --- Generate Payment Link ---
    cy.contains('a', 'Payment Links').click();
    cy.contains('button', 'Generate Link').click();

    cy.get('.ant-select-selection-item').then(($sel) => {
      if (!$sel.text().includes('One Time Use')) {
        cy.wrap($sel).click({ force: true });
        cy.get('.rc-virtual-list .ant-select-item-option')
          .contains('One Time Use')
          .click({ force: true });
      }
    });

     const ORDER_ID = "JZ" + Math.floor(1000000000 + Math.random() * 9000000000);
    cy.get('#reOrderId').clear().type(ORDER_ID);
    cy.get('#amount').clear().type('200');
    cy.get('button[type="submit"]').contains('Submit').click({ force: true });

    cy.get('a.linkText:visible').first().invoke('attr', 'href').as('paymentLink');

    // --- Open Payment Link ---
    // --- Open Payment Link ---
cy.log('⏳ Waiting for payment link...');
cy.get('div.linkPanel', { timeout: 30000 }).should('be.visible');

cy.get('div.linkPanel a.linkText', { timeout: 30000 })
  .should('have.length.greaterThan', 0)
  .first()
  .invoke('attr', 'href')
  .then((href) => {
    expect(href).to.be.a('string').and.not.be.empty;
    cy.wrap(href).as('paymentLink');
    cy.log("🔗 Payment Link: " + href);

    // -------------------------------
    // FIX: Visit payment link
    // -------------------------------
    cy.visit(href);

    // -------------------------------
    // FIX: Load iframe + SAVE ALIAS
    // -------------------------------
    cy.frameLoaded('iframe#iframe12345_\\#xpay_element_node');
    cy.get('iframe#iframe12345_\\#xpay_element_node')
      .should('exist')
      .as('paymentFrame');   // <-- FIX (important)

    // --- Fill card info inside iframe ---
    cy.get('@paymentFrame').then(($iframe) => {
      const iframeSelector = `iframe[src="${$iframe.attr('src')}"]`;
      cy.log(`✅ Using iframe selector: ${iframeSelector}`);

      cy.frameLoaded(iframeSelector);
      cy.iframe(iframeSelector).within(() => {
        cy.get('input[name="email"]').type(payer.email, { force: true });
        cy.get('input[name="customerName"]').type(payer.customerName, { force: true });
        cy.get('input[name="creditCard"]').clear().type(payer.creditCard);
        cy.get('input[name="exp"]').clear().type(payer.exp.replace('/', ''));
        cy.get('input[name="cvc"]').clear().type(payer.cvc);
      });
    });

    // --- Pay Now ---
    cy.get('#submitBtn', { timeout: 30000 })
      .should('exist')
      .should('not.be.disabled')
      .click({ force: true });

    // ----------------------------
    // 3DS handling (unchanged)
    // ----------------------------
    cy.log('⏳ Waiting for BAFL 3DS iframe...');
    cy.waitUntil(
      () =>
        Cypress.$('iframe[src*="acs"], iframe[src*="3ds"], iframe[src*="mastercard"], iframe#3ds-iframe').length > 0,
      {
        timeout: 60000,
        interval: 1000,
        errorMsg: '❌ No BAFL 3DS iframe appeared.',
      }
    );

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
        cy.log(`🔒 Found 3DS iframe: ${selector}`);

        cy.frameLoaded(selector, { timeout: 20000 });
        cy.iframe(selector).within(() => {
          cy.wait(2000);
          cy.get('select, #selectAuthResult', { timeout: 20000 })
            .first()
            .should('be.visible')
            .select('AUTHENTICATED', { force: true });

          cy.get('button, input[type="submit"], input[value="Submit"]', { timeout: 20000 })
            .first()
            .should('be.visible')
            .click({ force: true });
        });
      } else {
        cy.log('💨 No 3DS iframe detected — frictionless authentication.');
      }
    });

    // --- Verify success page ---
    cy.url({ timeout: 60000 }).should('not.include', 'stage.xta.ac');
    cy.log('✅ BAFL Credit Card payment flow completed successfully.');

    // ====================================================
    // SAVE ORDER ID + INTENT ID
    // ====================================================
    cy.get('@paymentLink').then((url) => {
      const intentId = url.split('/').pop();
      cy.wrap(intentId).as('intentId');
    });

    cy.wrap(ORDER_ID).as('orderId');

    // ====================================================
    // BACKEND VERIFICATION
    // ====================================================

    cy.visit('https://xpay-app-stage.postexglobal.com/');
    cy.contains('a', 'Transactions').click();
    cy.wait(2000);

    const maxAttempts = 5;

    function openLatest(tabName, searchValue) {
      let attempt = 0;

      function tryLoad() {
        attempt++;

        cy.get('table tbody tr', { timeout: 5000 }).then($rows => {
          const row = [...$rows].find(r => r.innerText.includes(searchValue));

          if (row) {
            cy.wrap(row).click({ force: true });
            cy.log(`✅ ${tabName} row loaded (attempt ${attempt})`);
          } else if (attempt < maxAttempts) {
            cy.log(`🔄 Refreshing ${tabName} (attempt ${attempt})`);
            cy.contains('a', tabName).click();
            cy.wait(2000);
            tryLoad();
          } else {
            throw new Error(`❌ ${tabName} row with ${searchValue} not found`);
          }
        });
      }

      tryLoad();
    }

    // --- Transaction Verification ---
    openLatest("Transactions", ORDER_ID);

    cy.get('@orderId').then(orderId => cy.contains(orderId).should('be.visible'));

    cy.get('@intentId').then(intentId =>
      cy.contains(intentId.substring(0, 12)).should('be.visible')
    );

    // --- Payment Intents ---
    cy.contains('a', 'Payment Intents').click();
    cy.wait(1000);

    openLatest("Payment Intents", ORDER_ID);

    cy.get('@orderId').then(orderId => cy.contains(orderId).should('be.visible'));

    cy.contains('Status').parent().should('contain.text', 'Succeeded');

    cy.log("🚀 FLOW COMPLETED SUCCESSFULLY");
  });
});
});