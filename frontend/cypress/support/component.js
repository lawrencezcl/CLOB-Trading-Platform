// ***********************************************************
// This example support/component.js is processed and
// loaded automatically before your component test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands'

// Import global styles or setup for component testing
import '../../src/index.css'

// Import component testing utilities
import { mount } from '@cypress/react'

// Add mount command for component testing
Cypress.Commands.add('mount', mount)

// Configure component testing environment
beforeEach(() => {
  // Set up any global mocks or configurations for component tests
  cy.window().then((win) => {
    // Mock localStorage for components that depend on it
    win.localStorage.setItem('cypress-component-test', 'true');
  });
});

// Example of how to create a custom mount command with providers
Cypress.Commands.add('mountWithProviders', (component, options = {}) => {
  const { providers = [], ...mountOptions } = options;
  
  const Wrapper = ({ children }) => {
    return providers.reduce(
      (acc, Provider) => <Provider>{acc}</Provider>,
      children
    );
  };

  return cy.mount(<Wrapper>{component}</Wrapper>, mountOptions);
});