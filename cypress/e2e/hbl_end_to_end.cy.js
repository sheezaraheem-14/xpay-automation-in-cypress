import 'cypress-iframe';
import 'cypress-wait-until';

describe('XStak HBL Gateway + Credit Card Payment Flow', () => {
  const portalUrl = 'https://xpay-app-stage.postexglobal.com/';
  const paymentUrl = 'https://js.xstak.com/react-stage/index.html';

  // --- Step 0: Login ---
  beforeEach(() => {
    cy.visit(portalUrl);

    cy.get('input[name="account_id"]').should('be.visible').type('0ddb82950784f875');
    cy.get('input[name="email"]').should('be.visible').type('aima.rauf@shopdev.co');
    cy.get('input[name="password"]').should('be.visible').type('Aima123!');
    cy.contains('button', 'Login').should('be.visible').click();

    cy.intercept('GET', '**/users/me').as('getUser');
    cy.wait('@getUser', { timeout: 30000 });
    cy.contains('Settings', { timeout: 30000 }).should('be.visible');
    cy.log('✅ Logged in successfully');
  });

  // --- Helper Functions ---
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

  // --- Main Test: Enable HBL and Perform Payment ---
  it('Enable HBL Gateway, make Credit Card payment, and handle 3DS OTP', () => {
    // Step 1: Enable HBL Gateway
    selectStore('GPay Stage Testing');
    goToGateways();

    cy.contains('td.ant-table-cell', 'HBL TEST')
      .parent('tr')
      .find('.table-action-btn')
      .contains('Edit')
      .click();

    cy.get('.GatewayModal').should('be.visible');

    let updateNeeded = false;

    // Enable toggle
    cy.get('#disabled').then(($btns) => {
      const visibleBtns = $btns.filter(':visible');
      visibleBtns.each((_, btn) => {
        if (btn.getAttribute('aria-checked') !== 'true') {
          cy.wrap(btn).click();
          updateNeeded = true;
          cy.log('✅ Enable toggle turned ON');
        }
      });
    });

    // Default toggle
    cy.get('body').then(($body) => {
      const $btns = $body.find('#isDefault:visible');
      $btns.each((_, btn) => {
        if (btn.getAttribute('aria-checked') !== 'true') {
          cy.wrap(btn).click();
          updateNeeded = true;
          cy.log('✅ Default toggle turned ON');
        }
      });
    });

    // Update modal if needed
    cy.then(() => {
      if (updateNeeded) {
        cy.get('.GatewayModal').contains('button', 'Update').click();
        cy.log('✅ Gateway updated');
      } else {
        cy.log('ℹ️ No changes needed');
      }
    });

    // Step 2: Visit Payment Page
    cy.visit(paymentUrl);
    cy.log('🧭 Navigated to Payment Page');

    // Step 3: Fill Credit Card inside iframe
    cy.get('iframe', { timeout: 40000 }).should('exist').then(($iframes) => {
      const paymentIframe = [...$iframes].find((f) => f.src.includes('v4/core-stage'));
      if (!paymentIframe) throw new Error('❌ Payment iframe not found');
      cy.wrap(paymentIframe).as('paymentFrame');
    });

    cy.get('@paymentFrame').then(($iframe) => {
      const selector = `iframe[src="${$iframe.attr('src')}"]`;
      cy.frameLoaded(selector);
      cy.iframe(selector).within(() => {
        cy.get('input[name="creditCard"]').should('be.visible').clear().type('5123 4500 0000 0008');
        cy.get('input[name="exp"]').clear().type('0139');
        cy.get('input[name="cvc"]').clear().type('100');
      });
    });

    cy.contains('button', 'Pay Now', { timeout: 20000 }).click({ force: true });

    // Step 4: Handle 3DS OTP
    cy.log('⏳ Waiting for 3DS popup...');
    cy.waitUntil(() => Cypress.$('div#3ds-popup-main').length > 0, {
      timeout: 60000,
      interval: 1000,
      errorMsg: '❌ 3DS popup never appeared'
    });

    cy.waitUntil(() => Cypress.$('div#3ds-popup-main').css('display') !== 'none', {
      timeout: 60000,
      interval: 1000,
      errorMsg: '❌ 3DS popup stayed hidden'
    });

    cy.get('iframe#3ds-iframe', { timeout: 60000 }).should('be.visible').then(($iframe) => {
      cy.wrap($iframe.contents().find('input[name="challengeDataEntry"]'))
        .should('be.visible')
        .type('1234', { force: true });

      cy.wrap($iframe.contents().find('input[type="submit"][value="SUBMIT"]'))
        .should('be.visible')
        .click({ force: true });
    });

    cy.log('✅ Payment and 3DS OTP flow completed successfully');
  });
});
