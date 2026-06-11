/** @type {import('../src/index').AxigenConfig} */
module.exports = {
  input: './openapi.yaml',
  output: {
    client: './generated/client.ts',
    types: './generated/types.ts',
  },
  axiosInstancePath: '../lib/axios',
  axiosInstanceExport: 'axiosInstance',
  language: 'ts',
  jsdoc: true,
}
