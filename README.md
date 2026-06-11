# axigen

> Generate typed Axios client functions from OpenAPI / Swagger specs

[![npm version](https://img.shields.io/npm/v/axigen)](https://www.npmjs.com/package/axigen)
[![license](https://img.shields.io/npm/l/axigen)](./LICENSE)

## نصب

```bash
npm install -D axigen
# یا
pnpm add -D axigen
```

## شروع سریع

**۱. ساخت فایل کانفیگ:**

```bash
npx axigen init
```

**۲. ویرایش `axigen.config.js`:**

```js
/** @type {import('axigen').AxigenConfig} */
module.exports = {
  input: "./openapi.yaml",
  output: {
    client: "./src/api/client.ts",
    types: "./src/api/types.ts",
  },
  axiosInstancePath: "../lib/axios",
  language: "ts",
  jsdoc: true,
};
```

**۳. Generate:**

```bash
npx axigen generate
# یا کوتاه‌تر:
npx axigen
```

## خروجی

از این OpenAPI:

```yaml
paths:
  /users/{userId}:
    get:
      operationId: getUserById
      parameters:
        - name: userId
          in: path
          required: true
```

این کد generate میشه:

```ts
/**
 * دریافت کاربر با ID
 * `GET /users/{userId}`
 */
export async function getUserById(userId: GetUserByIdPathParams["userId"]): Promise<AxiosResponse<GetUserByIdResponse>> {
  return axiosInstance.get(`/users/${userId}`);
}
```

## گزینه‌های کانفیگ

| گزینه                 | نوع            | پیش‌فرض         | توضیح                               |
| --------------------- | -------------- | --------------- | ----------------------------------- |
| `input`               | `string`       | —               | مسیر فایل OpenAPI (yaml یا json)    |
| `output.client`       | `string`       | —               | مسیر خروجی فایل توابع               |
| `output.types`        | `string`       | —               | مسیر خروجی فایل types (اختیاری)     |
| `axiosInstancePath`   | `string`       | —               | مسیر import مربوط به axios instance |
| `axiosInstanceExport` | `string`       | `axiosInstance` | نام export                          |
| `language`            | `'ts' \| 'js'` | `'ts'`          | زبان خروجی                          |
| `jsdoc`               | `boolean`      | `true`          | اضافه کردن JSDoc                    |
| `tags`                | `string[]`     | —               | فیلتر بر اساس تگ                    |

## دستورات CLI

```bash
axigen generate [--config <path>] [--cwd <path>]
axigen init
axigen --version
axigen --help
```

## استفاده programmatic

```ts
import { generate, loadConfig } from "axigen";

const config = await loadConfig(process.cwd());
const result = await generate(config, process.cwd());
console.log(`Generated ${result.endpointCount} endpoints`);
```

## لایسنس

MIT
