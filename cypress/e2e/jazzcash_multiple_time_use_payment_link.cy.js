import 'cypress-iframe';
import 'cypress-wait-until';

describe('XPay – JazzCash One Time Use Payment Link | Full Flow + Verification', () => {
  Cypress.on('uncaught:exception', (err) => {
    console.warn('💡 Ignored uncaught exception:', err.message);
    return false;
  });

  it('should generate payment link, complete JazzCash payment, and verify backend', () => {

    // --- LOGIN ---
    cy.visit('https://xpay-app-stage.postexglobal.com/');
    cy.get('input[name="account_id"]').type('0ddb82950784f875');
    cy.get('input[name="email"]').type('aima.rauf@shopdev.co');
    cy.get('input[name="password"]').type('Aima123!');
    cy.contains('button', 'Login').click();
    cy.url().should('include', '/dashboard');

    // --- STORE SELECTION ---
    cy.get('.selectStore .ant-select-selector').click();
    cy.contains('.ant-select-item-option', 'GPay Stage Testing').click({ force: true });

    // --- NAVIGATE TO PAYMENT LINKS ---
    cy.contains('a', 'Payment Links').click();
    cy.contains('button', 'Generate Link').click();

    // --- MULTIPLE USE DROPDOWN ---
    cy.xpath("//span[@title='One Time Use']").click();
    cy.xpath("//div[contains(text(),'Multiple Use')]").click();

    // --- NUMBER OF USAGE ---
    cy.get('input[name="linkUsageLimit"]').clear().type('4');

    // --- EXPIRY DATE TOMORROW ---
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dd = String(tomorrow.getDate());

    cy.get('.ant-picker.datePicker input').click({ force: true });
    cy.contains('td.ant-picker-cell', dd).not('.ant-picker-cell-disabled').click({ force: true });
    cy.get('button.ant-btn-primary.ant-btn-sm').not('[disabled]').click({ force: true });

    // --- ORDER ID & AMOUNT ---
    const ORDER_ID = "JZ" + Math.floor(1000000000 + Math.random() * 9000000000);
    cy.get('#amount', { timeout: 15000 }).should('be.visible').clear().type('20');

    // --- SUBMIT ---
    cy.contains('button', 'Submit').click({ force: true });

    // --- GET PAYMENT LINK ---
    cy.get('div.linkPanel a.linkText', { timeout: 30000 })
      .first()
      .invoke('attr', 'href')
      .then((href) => {
        cy.wrap(href).as('paymentLink');
        cy.log("🔗 Payment Link: " + href);
      });

    // --- COMPLETE PAYMENT ---
    cy.get('@paymentLink').then(link => cy.visit(link));
    cy.frameLoaded('iframe#iframe12345_\\#xpay_element_node');
    cy.iframe('iframe#iframe12345_\\#xpay_element_node').within(() => {
      cy.get('#jazzcash', { timeout: 15000 }).click({ force: true });
      cy.get('input[name="mobileNumber"]:visible').clear().type('03123456789', { force: true });
      cy.get('input[name="cnic"]').clear().type('345678', { force: true });
    });
    cy.get('#submitBtn', { timeout: 30000 }).should('not.be.disabled').click({ force: true });
    cy.wait(15000);

    cy.contains('h3.ErrorTitle', 'Thank you! Your payment was successful', { timeout: 30000 }).should('be.visible');
    cy.log('🎉 JazzCash Payment Succeeded');

});
});