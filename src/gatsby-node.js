const fetch = require("node-fetch");
const chalk = require("chalk");
const log = console.log;

exports.sourceNodes = async (
  { actions: { createNode }, createContentDigest, createNodeId },
  { api }
) => {
  log(chalk.black.bgWhite("Starting Personio Source plugin"));

  if (!api) {
    log(
      chalk.bgRed("You seem to be missing API details in your gatsby-config.js")
    );
    return;
  }

  let auth;

  try {
    let response = await fetch(
      `https://api.personio.de/v1/auth?client_id=${api.clientId}&client_secret=${api.clientSecret}`,
      {
        method: "POST",
        headers: { accept: "application/json" },
      }
    );
    auth = await response.json();
  } catch (err) {
    log(chalk.bgRed("There was an error retrieving the auth token"));
    log(err);
  }

  let result;

  try {
    let response = await fetch(`https://api.personio.de/v1/company/employees`, {
    method: "GET",
      headers: { Authorization: `Bearer ${auth.data.token}` },
    });
    result = await response.json();
  } catch (err) {
    log(chalk.bgRed("There was an error retrieving the employees list"));
    log(err);
  }

  if (result.data) {
    result.data.forEach((employee) => {
        let attributes = employee.attributes;
        log(attributes);
        
        let newEmployeeNode = {
            id: createNodeId(`employee-${attributes.id.value.toString()}`),
            internal: {
                type: "Employee",
                contentDigest: createContentDigest(attributes),
            },
            employeeId: attributes.id.value,
            first_name: attributes.first_name.value,
            last_name: attributes.last_name.value,
            position: attributes.position.value,
            profile_picture: attributes.profile_picture.value,
            status: attributes.status.value
        };
        
        createNode(newEmployeeNode);
    })
  }

  return result;
};
