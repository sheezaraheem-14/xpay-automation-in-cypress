import 'cypress-iframe';

describe('XPay Gateway Configuration - BAFL Test', () => {

  before(() => {
    cy.visit('https://xpay-app-stage.postexglobal.com/')

    cy.get('input[name="account_id"]').should('be.visible').type('0ddb82950784f875')
    cy.get('input[name="email"]').should('be.visible').type('aima.rauf@shopdev.co')
    cy.get('input[name="password"]').should('be.visible').type('Aima123!')

    cy.contains('button', 'Login').should('be.visible').click()

    cy.intercept('GET', '**/users/me').as('getUser')
    cy.wait('@getUser', { timeout: 30000 })

    cy.contains('Settings', { timeout: 30000 }).should('be.visible')
    cy.log('✅ Logged in successfully and dashboard loaded')
  })

  const selectStore = (storeName) => {
    cy.get('.selectStore .ant-select-selector').click()
    cy.get('.rc-virtual-list .ant-select-item-option')
      .contains(storeName)
      .click({ force: true })
    cy.get('.selectStore .ant-select-selection-item')
      .should('have.text', storeName)
  }

  const goToGateways = () => {
    cy.contains('Settings').click()
    cy.contains('Gateways').click()
  }

  it('Enable BAFL Test Gateway properly with toggle checks', () => {
    selectStore('GPay Stage Testing')
    goToGateways()

    // Edit BAFL Test Gateway
    cy.contains('td.ant-table-cell', 'BAFL Test')
      .parent('tr')
      .find('div.table-action-btn')
      .contains('Edit')
      .click()

    // Wait for modal
    cy.get('.GatewayModal').should('be.visible')

    let updateNeeded = false

    // Handle Enable toggle (same logic as HBL)
    cy.get('#disabled').then(($btns) => {
      const visibleBtns = $btns.filter(':visible')
      if (visibleBtns.length === 0) {
        cy.log('⚠️ No Enable button visible')
        return
      }

      if (visibleBtns.length === 1) {
        const isEnabled = visibleBtns[0].getAttribute('aria-checked') === 'true'
        if (isEnabled) {
          cy.log('ℹ️ Gateway already enabled')
        } else {
          cy.wrap(visibleBtns[0]).click()
          updateNeeded = true
          cy.log('✅ Gateway enabled')
        }
      } else {
        visibleBtns.each((_, btn) => {
          const isChecked = btn.getAttribute('aria-checked') === 'true'
          if (!isChecked) {
            cy.wrap(btn).click()
            updateNeeded = true
            cy.log('✅ Enable button turned ON')
          }
        })
      }
    })

    // Handle Default toggle
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
            } else {
              cy.log('ℹ️ Default toggle already ON')
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

