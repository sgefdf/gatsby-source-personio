# gatsby-source-personio

This is a source plugin for fetching employees list from the Personio API

## Set The Config

In `gatsby-config.js`:

```js
module.exports = {
    plugins: [
        {
            resolve: 'gatsby-source-personio',
            options: {
                clientId: 'YOUR_ID',
                clientSecret: 'YOUR_SECRET'
            },
        },
    ],
}
```
