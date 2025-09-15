/**
 * Module Resolution Configuration for l0166 PCI
 * This file configures RequireJS for loading the PCI and its dependencies
 */

// RequireJS configuration for the l0166 PCI
requirejs.config({
  waitSeconds: 60,
  paths: {
    // Main PCI module
    'l0166PCI': '../dist/customPCI/interaction',

    // React dependencies (if needed as external)
    // 'react': 'https://unpkg.com/react@18/umd/react.production.min',
    // 'react-dom': 'https://unpkg.com/react-dom@18/umd/react-dom.production.min',

    // Graffiticode L0166 Form component
    // Note: Currently bundled in interaction.js
    // '@graffiticode/l0166': '../node_modules/@graffiticode/l0166/dist/index'
  },

  // Shim configuration for non-AMD modules if needed
  shim: {
    // Add shims here if any dependencies are not AMD-compatible
  }
});

// Export the configuration for use by qti3-item-player
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    waitSeconds: 60,
    paths: {
      'l0166PCI': '../dist/customPCI/interaction'
    }
  };
}