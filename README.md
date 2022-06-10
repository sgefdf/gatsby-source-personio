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
                credentials: {
                    clientId: 'YOUR_ID',
                    clientSecret: 'YOUR_SECRET'
                },
              //apiUrl: 'http://localhost'
              //can be set for local development, defaults to regular Personio API
            },
        },
    ],
}
```
