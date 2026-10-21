declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Load a Cypress fixture as a browser `File` suitable for FFprobeWorker.
       */
      loadFFprobeFile(
        fixture: string,
        name: string,
        mimeType: string,
      ): Chainable<File>;
    }
  }
}

Cypress.Commands.add(
  "loadFFprobeFile",
  (fixture: string, name: string, mimeType: string) => {
    return cy.fixture(fixture, "base64").then((b64: string) => {
      return cy.window().then((win) => {
        const bin = win.atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new win.File([bytes], name, { type: mimeType });
      });
    });
  },
);

export {};