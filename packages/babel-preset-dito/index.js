module.exports = function() {
  return {
    plugins: [
      // Stage 1
      require('@babel/plugin-proposal-export-default-from'),
      [
        require('@babel/plugin-proposal-optional-chaining'),
        { loose: false }
      ],
      [
        require('@babel/plugin-proposal-nullish-coalescing-operator'),
        { loose: false }
      ],

      // Stage 2
      [
        require('@babel/plugin-proposal-decorators'),
        { legacy: true }
      ],
      require('@babel/plugin-proposal-export-namespace-from'),

      // Stage 3
      require('@babel/plugin-syntax-dynamic-import'),
      [
        require('@babel/plugin-proposal-class-properties'),
        { loose: false }
      ]
    ]
  }
}
