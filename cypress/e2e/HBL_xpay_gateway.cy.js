describe('XPay Gateway Configuration', () => {

  beforeEach(() => {
    // Visit login page
    cy.visit('https://xpay-app-stage.postexglobal.com/')

    // Login
    cy.get('input[name="account_id"]').should('be.visible').type('0ddb82950784f875')
    cy.get('input[name="email"]').should('be.visible').type('aima.rauf@shopdev.co')
    cy.get('input[name="password"]').should('be.visible').type('Aima123!')

    cy.contains('button', 'Login').should('be.visible').click()

    // Wait for user data to load
    cy.intercept('GET', '**/users/me').as('getUser')
    cy.wait('@getUser', { timeout: 30000 })

    // Ensure dashboard is visible
    cy.contains('Settings', { timeout: 30000 }).should('be.visible')
    cy.log('✅ Logged in successfully and dashboard loaded')
  })

  // Helper to select a store
  const selectStore = (storeName) => {
    cy.get('.selectStore .ant-select-selector').click()
    cy.get('.rc-virtual-list .ant-select-item-option')
      .contains(storeName)
      .click({ force: true })
    cy.get('.selectStore .ant-select-selection-item')
      .should('have.text', storeName)
  }

  // Helper to go to Gateways settings
  const goToGateways = () => {
    cy.contains('Settings').click()
    cy.contains('Gateways').click()
  }



 it('Enable HBL Test Gateway properly with toggle checks', () => {
  selectStore('GPay Stage Testing')
  goToGateways()

  // Edit HBL Test Gateway
  cy.contains('td.ant-table-cell', 'HBL TEST')
    .parent('tr')
    .find('.table-action-btn')
    .contains('Edit')
    .click()

  // Wait for modal
  cy.get('.GatewayModal').should('be.visible')

  let updateNeeded = false

  // Handle Enable toggle
  cy.get('#disabled').then(($btns) => {
    const visibleBtns = $btns.filter(':visible')

    if (visibleBtns.length === 0) {
      cy.log('⚠️ No Enable button visible')
      return
    }

    if (visibleBtns.length === 1) {
      const isEnabled = visibleBtns.attr('aria-checked') === 'true'
      if (isEnabled) {
        cy.log('ℹ️ Gateway already enabled')
      } else {
        cy.wrap(visibleBtns).click()
        updateNeeded = true
        cy.log('✅ Gateway enabled')
      }
    } else {
      // Multiple buttons scenario
      visibleBtns.each(($btn) => {
        const isChecked = $btn.attr('aria-checked') === 'true'
        if (!isChecked) {
          cy.wrap($btn).click()
          updateNeeded = true
          cy.log('✅ Enable button turned ON')
        }
      })
    }
  })

  // Handle Default toggle only if it exists
  cy.get('body').then(($body) => {
    if ($body.find('#isDefault').length > 0) {
      const $btns = $body.find('#isDefault:visible')
      if ($btns.length > 0) {
        $btns.each((_, btn) => {
          const isDefault = btn.getAttribute('aria-checked') === 'true'
          if (!isDefault) {
            cy.wrap(btn).click()
            updateNeeded = true
            cy.log('✅ Default toggle turned ON')
          }
        })
      } else {
        cy.log('ℹ️ Default toggle not visible')
      }
    } else {
      cy.log('ℹ️ Default toggle does not exist for this gateway')
    }
  })

  // Click Update only if changes were made
  cy.then(() => {
    if (updateNeeded) {
      cy.get('.GatewayModal').contains('button', 'Update').click()
      cy.log('✅ Update clicked')
    } else {
      cy.log('ℹ️ No changes needed, Update not clicked')
    }
  })
})
})