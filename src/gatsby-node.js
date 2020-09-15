const fetch = require("node-fetch");
const chalk = require("chalk");
const { createRemoteFileNode } = require("gatsby-source-filesystem");
const log = console.log;

exports.sourceNodes = async (
  {
    actions,
    getNode,
    store,
    cache,
    createNodeId,
    createContentDigest,
    getCache,
    reporter,
  },
  { credentials }
) => {
  log(chalk.black.bgWhite("Starting Personio Source plugin"));
  const { createNode, createParentChildLink, touchNode } = actions;

  if (!credentials) {
    log(
      chalk.bgRed(
        "You seem to be missing API credentials in your gatsby-config.js"
      )
    );
    return;
  }

  let result;
  const token = await getToken(credentials);

  try {
    let response = await fetch(`https://api.personio.de/v1/company/employees`, {
      method: "GET",
      headers: { Authorization: token },
    });
    result = await response.json();
  } catch (err) {
    log(chalk.bgRed("There was an error retrieving the employees list"));
    log(err);
  }

  let employees = [];
  if (result.data) {
    result.data.forEach((employee) => {
      let attributes = employee.attributes;

      let newEmployeeNode = {
        internal: {
          type: "Employee",
          contentDigest: createContentDigest(attributes),
        },
      };

      Object.keys(attributes).forEach((key) => {
        if (typeof attributes[key].value === "string")
          newEmployeeNode[key] = attributes[key].value;
        else if (attributes[key].value !== null)
          newEmployeeNode[key] = attributes[key].value.toString();
      });

      createNode(newEmployeeNode);
      employees.push(newEmployeeNode);
    });
  }

  return await downloadProfilePictures(
    employees,
    store,
    cache,
    createNode,
    createNodeId,
    createParentChildLink,
    touchNode,
    getCache,
    getNode,
    reporter,
    credentials
  );
};

async function getToken(credentials) {
  let token;

  try {
    let response = await fetch(
      `https://api.personio.de/v1/auth?client_id=${credentials.clientId}&client_secret=${credentials.clientSecret}`,
      {
        method: "POST",
        headers: { accept: "application/json" },
      }
    );
    token = `Bearer ${(await response.json()).data.token}`;
  } catch (err) {
    log(chalk.bgRed("There was an error retrieving the auth token"));
    log(err);
  }

  return token;
}

async function downloadProfilePictures(
  employees,
  store,
  cache,
  createNode,
  createNodeId,
  createParentChildLink,
  touchNode,
  getCache,
  getNode,
  reporter,
  credentials,
) {
  Promise.all(
    employees.map(async (employee) => {
      let fileNodeID;
      if (employee.profile_picture) {
        const profilePictureCacheKey = `profile-picture-${employee.id}`;
        const cacheProfilePicture = await cache.get(profilePictureCacheKey);

        // If we have cached profile picture reuse
        // previously created file node to not try to redownload
        if (cacheProfilePicture) {
          const fileNode = getNode(cacheProfilePicture.fileNodeID);

          // check if node still exists in cache
          // it could be removed if image was made private
          if (fileNode) {
            fileNodeID = cacheProfilePicture.fileNodeID;
            touchNode({
              nodeId: fileNodeID,
            });
          }
        }

        // If we don't have cached data, download the file
        if (!fileNodeID) {
          const token = await getToken(credentials);

          try {
            const fileNode = await createRemoteFileNode({
              url: employee.profile_picture,
              store,
              cache,
              createNode,
              createNodeId,
              getCache,
              parentNodeId: employee.id,
              reporter,
              httpHeaders: { Authorization: token },
            });

            if (fileNode) {
              fileNodeID = fileNode.id;

              await cache.set(profilePictureCacheKey, {
                fileNodeID,
              });
            }
          } catch (err) {
            log(
              chalk.bgRed("There was an error retrieving the profile picture")
            );
            log(err);
          }
        }
      }

      createParentChildLink(employee, fileNode);
      return employee;
    })
  );
}
