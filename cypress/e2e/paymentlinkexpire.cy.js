import 'cypress-iframe';
import 'cypress-wait-until';

describe('XPay – JazzCash One Time Use Payment Link | Full Flow + Reuse Validation', () => {

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

  it('should complete JazzCash payment and validate one-time link cannot be reused', () => {

    cy.visit('https://xpay-app-stage.postexglobal.com/');

    // --- LOGIN ---
    cy.get('input[name="account_id"]').type('0ddb82950784f875');
    cy.get('input[name="email"]').type('aima.rauf@shopdev.co');
    cy.get('input[name="password"]').type('Aima123!');
    cy.contains('button', 'Login').click();
    cy.url().should('include', '/dashboard');

    // --- STORE SELECTION ---
    cy.get('.selectStore .ant-select-selector').click();
    cy.contains('.ant-select-item-option', 'GPay Stage Testing').click({ force: true });

    // --- NAVIGATE TO PAYMENT LINKS & GENERATE ---
    cy.contains('a', 'Payment Links').click();
    cy.contains('button', 'Generate Link').click();

    // Ensure One Time Use is selected
    cy.get('.ant-select-selection-item').then(($sel) => {
      if (!$sel.text().includes('One Time Use')) {
        cy.wrap($sel).click({ force: true });
        cy.contains('.ant-select-item-option', 'One Time Use').click({ force: true });
      }
    });

    // --- RANDOM ORDER ID ---
    const ORDER_ID = "JZ" + Math.floor(1000000000 + Math.random() * 9000000000);
    cy.get('#reOrderId').clear().type(ORDER_ID);
    cy.get('#amount').clear().type('200');
    cy.contains('button', 'Submit').click({ force: true });

    // --- EXTRACT PAYMENT LINK ---
    cy.get('div.linkPanel a.linkText', { timeout: 30000 })
      .first()
      .invoke('attr', 'href')
      .then((href) => {
        cy.wrap(href).as('paymentLink');
        cy.log("🔗 Payment Link: " + href);
      });

    // --- COMPLETE JAZZCASH PAYMENT ---
    cy.get('@paymentLink').then((link) => cy.visit(link));

    cy.frameLoaded('iframe#iframe12345_\\#xpay_element_node');
    cy.iframe('iframe#iframe12345_\\#xpay_element_node').within(() => {
      cy.get('#jazzcash', { timeout: 15000 }).click({ force: true });
      cy.get('input[name="mobileNumber"]:visible').clear().type('03123456789', { force: true });
      cy.get('input[name="cnic"]').clear().type('345678', { force: true });
    });

    cy.get('#submitBtn', { timeout: 30000 }).should('not.be.disabled').click({ force: true });
    cy.wait(15000);

    // --- SUCCESS PAGE ASSERTION ---
    cy.contains('h3.ErrorTitle', 'Thank you! Your payment was successful', { timeout: 30000 })
      .should('be.visible');
    cy.log('🎉 JazzCash Payment Succeeded');

    // --- SAVE ORDER ID & INTENT ID ---
    cy.get('@paymentLink').then((url) => {
      const intentId = url.split('/').pop();
      cy.wrap(intentId).as('intentId');
    });
    cy.wrap(ORDER_ID).as('orderId');

    // --- BACKEND VERIFICATION ---
    cy.visit('https://xpay-app-stage.postexglobal.com/');
    cy.contains('a', 'Transactions').click();

    function checkTableRow(tabName, searchValue) {
      let attempt = 0;
      function retry() {
        attempt++;
        cy.contains('table tbody tr', searchValue, { timeout: 5000 }).then($row => {
          if ($row.length) {
            cy.wrap($row).click({ force: true });
            cy.log(`✅ ${tabName} row ${searchValue} loaded on attempt ${attempt}`);
          } else if (attempt < 5) {
            cy.contains('a', tabName).click();
            cy.wait(2000);
            retry();
          } else {
            throw new Error(`❌ ${tabName} row ${searchValue} not found`);
          }
        });
      }
      retry();
    }

    checkTableRow('Transactions', ORDER_ID);
    cy.get('@orderId').then(orderId => cy.contains(orderId).should('be.visible'));
    cy.get('@intentId').then(intentId => cy.contains(intentId.substring(0, 12)).should('be.visible'));
    cy.contains('a', 'Payment Intents').click();
    checkTableRow('Payment Intents', ORDER_ID);
    cy.get('@orderId').then(orderId => cy.contains(orderId).should('be.visible'));
    cy.contains('Status').parent().should('contain.text', 'Succeeded');

    cy.log("✅ Backend verification passed");

    // ==================================================
    // 🔁 TRY TO REUSE THE SAME PAYMENT LINK (ONE-TIME USE)
    // ==================================================
  // ==================================================
// 🔁 TRY TO REUSE THE SAME PAYMENT LINK (ONE-TIME USE)
// ==================================================

// 1️⃣ Go back to Payment Links tab
cy.contains('a', 'Payment Links').click();

// 2️⃣ Wait for the table to load and click the first link
// 1️⃣ Go back to Payment Links tab


// 2️⃣ Wait for the table to load and click the first link in the same tab
cy.get('td.ant-table-cell a.linkText', { timeout: 30000 })
  .first()
  .should('be.visible')
  .invoke('removeAttr', 'target')   // remove target="_blank" so it opens in same tab
  .click({ force: true });

// 3️⃣ Assert the error message for one-time use link
cy.contains(/already used|completed|expired/i, { timeout: 15000 })
  .should('be.visible');

cy.log('⚠️ Payment link reuse correctly blocked and error is displayed');
  });
});