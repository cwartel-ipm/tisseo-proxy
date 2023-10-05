const express = require("express");
const {
  createProxyMiddleware,
  responseInterceptor
} = require("http-proxy-middleware");
const Jimp = require("jimp");

const app = express();

/**
 * Original: https://upload.wikimedia.org/wikipedia/en/7/7d/Lenna_%28test_image%29.png
 * Redirect to manipulated image:
 */
app.get("/", (req, res) => {
  res.redirect("/wikipedia/en/7/7d/Lenna_%28test_image%29.png");
});

app.use(
  "/wikipedia",
  createProxyMiddleware({
    target: "https://upload.wikimedia.org/wikipedia",
    changeOrigin: true,
    selfHandleResponse: true,
    logger: console,
    on: {
      proxyRes: responseInterceptor(
        async (responseBuffer, proxyRes, req, res) => {
          const imageTypes = [
            "image/png",
            "image/jpg",
            "image/jpeg",
            "image/gif"
          ];
          if (imageTypes.includes(proxyRes.headers["content-type"])) {
            console.log(
              `${req.method} ${req.path} -> ${proxyRes.req.protocol}//${proxyRes.req.host}${proxyRes.req.path} [${proxyRes.statusCode}]`
            );

            try {
              const image = await Jimp.read(responseBuffer);
              image.flip(true, false);
              image.sepia();
              image.pixelate(5);
              return image.getBufferAsync(Jimp.AUTO);
            } catch (err) {
              console.log("image processing error: ", err);
              return responseBuffer;
            }
          }

          return responseBuffer;
        }
      )
    }
  })
);

app.listen(8080, () => {
  console.log("Manipulate Wikipedia images. Example:");
  console.log(
    "https://03rjl.sse.codesandbox.io/wikipedia/en/7/7d/Lenna_%28test_image%29.png"
  );
});
