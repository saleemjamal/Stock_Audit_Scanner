module.exports = {
  dependencies: {
    '@op-engineering/op-sqlite': {
      platforms: {
        android: {
          sourceDir: '../node_modules/@op-engineering/op-sqlite/android/',
          packageImportPath: 'import com.op.sqlite.OPSQLitePackage;',
        },
      },
    },
  },
};