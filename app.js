const express = require("express");
const request = require("request");
const querystring = require("querystring");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const shortid = require("shortid");

const SERVER_URL = "http://localhost:8888";
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

const client_id = process.env.CLIENT_ID || ""; // Your client id
const client_secret = process.env.CLIENT_SECRET || ""; // Your secret
const redirect_uri = process.env.REDIRECT_URI || `${SERVER_URL}/callback`; // Your redirect uri

const GET_TOKEN_URL = "https://accounts.spotify.com/api/token";

const stateKey = "spotify_auth_state";

const app = express();
console.log(1);

app
  .use(express.static(__dirname + "/public"))
  .use(cors({ credentials: true, origin: true, allowedHeaders: "*" }))
  .use(cookieParser());

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.get("/login", function(req, res) {
  const state = shortid(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  const scope = "user-read-private user-read-email";

  res
    .json({
      response_type: "code",
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    })
    .end();
});

app.get("/callback", function(req, res) {
  // your application requests refresh and access tokens
  // after checking the state parameter
  const code = req.query.code || null;
  const state = req.query.state || null;
  const storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect(
      "/#" +
        querystring.stringify({
          error: "state_mismatch"
        })
    );
  } else {
    res.clearCookie(stateKey);
    const authOptions = {
      url: GET_TOKEN_URL,
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: "authorization_code"
      },
      headers: {
        Authorization:
          "Basic " +
          new Buffer(client_id + ":" + client_secret).toString("base64")
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        const access_token = body.access_token,
          refresh_token = body.refresh_token;

        const options = {
          url: "https://api.spotify.com/v1/me",
          headers: { Authorization: "Bearer " + access_token },
          json: true
        };

        // use the access token to access the Spotify Web API
        // request.get(options, function(error, response, body) {
        //   console.log(body);
        // });

        const data = {
          access_token: access_token,
          refresh_token: refresh_token
        };
        res.redirect(`${CLIENT_URL}?${querystring.stringify(data)}`);
      } else {
        res.redirect(
          "/#" +
            querystring.stringify({
              error: "invalid_token"
            })
        );
      }
    });
  }
});

app.get("/refresh_token", function(req, res) {
  // requesting access token from refresh token
  const refresh_token = req.query.refresh_token;
  const authOptions = {
    url: GET_TOKEN_URL,
    headers: {
      Authorization:
        "Basic " +
        new Buffer(client_id + ":" + client_secret).toString("base64")
    },
    form: {
      grant_type: "refresh_token",
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      const access_token = body.access_token;
      res.send({
        access_token: access_token
      });
    }
  });
});

console.log("Listening on 8888");
app.listen(8888);
