module.exports = function() {
  return {
    plugins: [
      // Stage 1
      require('@babel/plugin-proposal-export-default-from'),

      // Stage 2
      [
        require('@babel/plugin-proposal-decorators'),
        { legacy: true }
      ],

      // Stage 3
      [
        require('@babel/plugin-proposal-class-properties'),
        { loose: false }
      ],

      // Stage 4
      require('@babel/plugin-syntax-dynamic-import'),
      require('@babel/plugin-proposal-export-namespace-from'),
      require('@babel/plugin-proposal-optional-catch-binding'),
      [
        require('@babel/plugin-proposal-optional-chaining'),
        { loose: false }
      ],
      [
        require('@babel/plugin-proposal-nullish-coalescing-operator'),
        { loose: false }
      ]
    ]
  }
}
