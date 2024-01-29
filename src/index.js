const cheerio = require("cheerio");
const express = require("express");
const {
  createProxyMiddleware,
  responseInterceptor,
} = require("http-proxy-middleware");

const app = express();

app.use("/client", express.static("client"));

app.use(
  "/",
  createProxyMiddleware({
    target: "https://www.tisseo.fr/",
    changeOrigin: true,
    pathFilter: ["!/client/*"],
    selfHandleResponse: true,
    secure: false,
    logger: console,
    on: {
      proxyRes: responseInterceptor(
        async (responseBuffer, proxyRes, req, res) => {
          console.log(req.path);
          // adapt html resources
          // TODO : check if we are requesting root or any other know resource
          if (req.path === "/") {
            document = cheerio.load(responseBuffer);
            document("body").empty();
            /*document("body").html(
              '<div style="margin: 0;position: absolute;top: 300px;left: 50%;-ms-transform: translate(-50%, -50%);transform: translate(-50%, -50%);" id="spinner"></div>',
            );*/
            // hide initial document
            /*document(
              //'<style type="text/css">body{visibility: hidden;}</style>',
              //'<script type="module" src="https://cdnjs.cloudflare.com/ajax/libs/spin.js/4.1.1/spin.min.js" integrity="sha512-FIiuNPo30HcyMzg2W0bkaWd9NvDW3bluEEa78u+V24a68OMGAdJ0cdj1/w0OeGuVZoxaym+HCtooUtWk7r/tFg==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>',
              '<script src="https://cdnjs.cloudflare.com/ajax/libs/spin.js/2.3.2/spin.js"></script>',
            ).appendTo("head");*/

            // inject client side script to SPA-ize
            document(
              //'<script type="text/javascript" src="https://6q2zmj.csb.app/src/index2.js" />',
              '<script type="text/javascript" src="client/SPA.js" />',
            ).appendTo("head");

            const response = document.html();
            //turn absolute links to relative ones
            return response
              .replaceAll("http://www.tisseo.fr", "")
              .replaceAll("https://www.tisseo.fr", "");
            //return responseBuffer;
          }

          if (proxyRes.headers["content-type"]?.includes("text/html")) {
            return responseBuffer
              .toString("utf8")
              .replaceAll("http://www.tisseo.fr", "")
              .replaceAll("https://www.tisseo.fr", "");
          }
          //leave other resource as is
          return responseBuffer;
        },
      ),
    },
  }),
);

var port = process.env["PORT"] || 8080;
app.listen(port, () => {});
