import 'cypress-iframe';
import 'cypress-wait-until';

describe('XPay Payment Flow with BAFL 3DS Challenge', () => {

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

    // --- LOGIN ---
    cy.visit('https://xpay-app-stage.postexglobal.com/');
    cy.get('input[name="email"]').type('aima.rauf@shopdev.co');
    cy.get('input[name="account_id"]').type('0ddb82950784f875');
    cy.get('input[name="password"]').type('Aima123!');
    cy.contains('button', 'Login').click().wait(5000);

    // --- STORE SELECTION (Your New Code) ---
    cy.xpath("//span[@title='All Stores']").click();
    cy.get('.rc-virtual-list .ant-select-item-option')
      .contains('GPay Stage Testing')
      .click({ force: true });

    // --- PAYMENT LINKS (Your New Code) ---
    cy.xpath("//a[normalize-space()='Payment Links']").click();
    cy.xpath("//button[@class='ant-btn ant-btn-default createBtn primaryBtn mr-4 rounded-lg']").click();

    // --- MULTIPLE USE DROPDOWN (Your New Code) ---
    cy.xpath("//span[@title='One Time Use']").click();
    cy.xpath("//div[contains(text(),'Multiple Use')]").click();

    // --- ENTER NUMBER OF USAGE ---
    cy.get('input[name="linkUsageLimit"]').clear().type('4');

   // --- SET EXPIRY DATE ---
// --- SET EXPIRY DATE (TOMORROW) ---
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const dd = String(tomorrow.getDate());

// Open date picker
cy.get('.ant-picker.datePicker input').click({ force: true });

// Select the next day
cy.contains('td.ant-picker-cell', dd)
  .not('.ant-picker-cell-disabled')
  .click({ force: true });

// Click OK
cy.get('button.ant-btn-primary.ant-btn-sm')
  .not('[disabled]')
  .click({ force: true });

cy.wait(1000);

// --- ORDER ID & AMOUNT ---
// --- ENTER ORDER ID ---
const ORDER_ID = "JZ" + Math.floor(1000000000 + Math.random() * 9000000000);


// --- ENTER ORDER AMOUNT ---
cy.get('#amount', { timeout: 15000 })
  .should('be.visible')
  .clear()
  .type('20');


    // --- SUBMIT ---
    cy.contains('button', 'Submit').click({ force: true });

    // --- GET PAYMENT LINK ---
    cy.get('div.linkPanel a.linkText', { timeout: 30000 })
      .first()
      .invoke('attr', 'href')
      .then((href) => {
        cy.wrap(href).as('paymentLink');
        cy.visit(href);

        // --- PAYMENT IFRAME ---
        cy.frameLoaded('iframe#iframe12345_\\#xpay_element_node');
        cy.get('iframe#iframe12345_\\#xpay_element_node').as('paymentFrame');

        cy.get('@paymentFrame').then(($iframe) => {
          const selector = `iframe[src="${$iframe.attr('src')}"]`;
          cy.iframe(selector).within(() => {
            cy.get('input[name="email"]').type(payer.email, { force: true });
            cy.get('input[name="customerName"]').type(payer.customerName, { force: true });
            cy.get('input[name="creditCard"]').clear().type(payer.creditCard);
            cy.get('input[name="exp"]').clear().type(payer.exp.replace('/', ''));
            cy.get('input[name="cvc"]').clear().type(payer.cvc);
          });
        });

        cy.get('#submitBtn').should('exist').click({ force: true });

        // --- 3DS CHALLENGE ---
        cy.waitUntil(
          () => Cypress.$('iframe[src*="acs"], iframe[src*="3ds"], iframe[src*="mastercard"], iframe#3ds-iframe').length > 0,
          { timeout: 60000, interval: 1000 }
        );

        cy.get('iframe').then(($iframes) => {
  const threeDSFrame = [...$iframes].find(
    f => f.src.includes('acs') || f.src.includes('3ds') || f.src.includes('mastercard') || f.id === '3ds-iframe'
  );

  if (threeDSFrame) {
    const selector = `iframe[src="${threeDSFrame.src}"]`;

    // Wait until the select element is available
    cy.iframe(selector).find('#selectAuthResult', { timeout: 30000 })
      .should('exist')
      .select('AUTHENTICATED', { force: true });

    // Click Submit button after selection
    cy.iframe(selector).find('button, input[type="submit"], input[value="Submit"]').first().click({ force: true });
  }
});

        // --- SUCCESS PAGE ---
        cy.url({ timeout: 60000 }).should('not.include', 'stage.xta.ac');

        cy.wrap(ORDER_ID).as('orderId');
        const intentId = href.split('/').pop();
        cy.wrap(intentId).as('intentId');

        // --- BACKEND VERIFICATION ---
        // BACKEND VERIFICATION
    // ====================================================

    cy.visit('https://xpay-app-stage.postexglobal.com/');
    cy.contains('a', 'Transactions').click();
    cy.wait(2000);

   function openLatest(tabName, searchValue) {
  const maxAttempts = 10; // increase max attempts
  let attempt = 0;

  function tryLoad() {
    attempt++;

    cy.get('table tbody tr', { timeout: 10000 }).then($rows => {
      const row = [...$rows].find(r => r.innerText.includes(searchValue));

      if (row) {
        cy.wrap(row).click({ force: true });
        cy.log(`✅ ${tabName} row loaded (attempt ${attempt})`);
      } else if (attempt < maxAttempts) {
        cy.log(`🔄 Refreshing ${tabName} (attempt ${attempt})`);
        cy.contains('a', tabName).click();
        cy.wait(5000); // wait longer for backend to populate
        tryLoad();
      } else {
        throw new Error(`❌ ${tabName} row with ${searchValue} not found after ${maxAttempts} attempts`);
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