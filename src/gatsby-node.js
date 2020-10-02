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

  if (result.data) {
    await createEmployeeNodes(
      result.data,
      store,
      cache,
      createNode,
      createNodeId,
      createParentChildLink,
      createContentDigest,
      touchNode,
      getCache,
      getNode,
      reporter,
      credentials
    );
  }
};

function personioParser(object, node) {
  if ("attributes" in object) {
    let attributes = object.attributes;

    Object.keys(attributes).forEach((key) => {
      const attribute = attributes[key];
      if (attribute === null) {
        return;
      } else if (typeof attribute === "object") {
        const label = cleanLabel(attribute.label);
        if (attribute.value === null)
          return;
        else if (typeof attribute.value === "string")
          node[label] = attribute.value;
        else if (typeof attribute.value === "number")
          node[label] = attribute.value.toString();
        else if (typeof attribute.value === "object") {
          node[label] = {};
          personioParser(attribute.value, node[label]);
        }
      } else {
        if (typeof attribute === "number")
          node[key] = attribute.toString();
        else
          node[key] = attribute;
      }
    });
  }
}

function cleanLabel(label) {
  return label.replace(/[^\w\s]|_/g, "").replace(/\s/g, "_").toLowerCase();
}

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

async function createEmployeeNodes(
  employees,
  store,
  cache,
  createNode,
  createNodeId,
  createParentChildLink,
  createContentDigest,
  touchNode,
  getCache,
  getNode,
  reporter,
  credentials,
) {
  await Promise.all(
    employees.map(async (employee) => {
      let employeeNode = {
        internal: {
          type: "Employee",
          contentDigest: createContentDigest(employee),
        },
      };
      personioParser(employee, employeeNode);
      await createNode(employeeNode);

      if (employeeNode.profile_picture) {
        let fileNode, fileNodeID;
        const profilePictureCacheKey = `profile-picture-${employeeNode.id}`;
        const cacheProfilePicture = await cache.get(profilePictureCacheKey);

        // If we have cached profile picture reuse
        // previously created file node to not try to redownload
        if (cacheProfilePicture) {
          fileNode = getNode(cacheProfilePicture.fileNodeID);

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
            fileNode = await createRemoteFileNode({
              url: employeeNode.profile_picture,
              store,
              cache,
              createNode,
              createNodeId,
              getCache,
              parentNodeId: employeeNode.id,
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
        
        await createParentChildLink({ parent: employeeNode, child: fileNode });
      }
    })
  );
}
