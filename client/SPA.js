// TODO
// - can reshape and cache behaviour be merged ?
// - proxify to cache any web site, needs inlining of external elements : https://github.com/bernd-wechner/Copy-with-Style/tree/master
//                                                                        https://codesandbox.io/p/devbox/siteproxy-m8zp7k?file=%2Findex.js
//                                                                        https://www.npmjs.com/package/http-proxy-middleware

// NEEDS FIX :  enable mix content : https://stackoverflow.com/questions/67765238/mixed-content-the-page-at-was-loaded-over-https-but-requested-an-insecure-resour

// not necessary ...
function loadJS(FILE_URL) {
  let scriptEle = document.createElement("script");
  scriptEle.setAttribute("src", FILE_URL);
  scriptEle.setAttribute("type", "text/javascript");
  scriptEle.setAttribute("defer", "true");
  document.head.appendChild(scriptEle);
}

//loadJS("https://cdn.jsdelivr.net/gh/emn178/js-md5/build/md5.min.js", false);

// awaitable function
function blobToBase64(blob) {
  return new Promise((resolve, _) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

function waitForElm(node, selector) {
  return new Promise((resolve) => {
    if (node.querySelector(selector)) {
      return resolve(node.querySelector(selector));
    }

    const observer = new MutationObserver((mutations) => {
      if (node.querySelector(selector)) {
        observer.disconnect();
        resolve(node.querySelector(selector));
      }
    });

    observer.observe(node, {
      childList: true,
      subtree: true,
    });
  });
}

// tweak the original https://www.tisseo.fr/se-deplacer/horaires page
// to display only lines list
reshape = function (node) {
  return new Promise((resolve) => {
    //*catch and clone the part of the DOM to keep
    waitForElm(node, "div.region.region-content.row-top-buffer").then((elm) => {
      clone = elm.cloneNode(true);

      //* add cloned part after main node of the DOM
      r = node.getElementsByClassName("dialog-off-canvas-main-canvas");
      r[0].after(clone);

      //* remove main part and thus keep only cloned part
      r[0].remove();

      //* remove search filter
      node.getElementsByClassName("view-filters")[0].remove();

      resolve(node);
    });
  });
};

const SPACache = (function () {
  const cache = {};

  function fetchPage(url) {
    return fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.text();
      })
      .catch((error) => {
        console.error("Error fetching page:", error);
      });
  }

  function cachePage(url, node) {
    cache[url] = node;
  }

  function getPage(url) {
    if (cache[url]) {
      return Promise.resolve(cache[url]);
    } else {
      // when HTML content is fetched...
      return fetchPage(url).then((content) => {
        //create a loose DOM node
        head = document.createElement("html");
        head.innerHTML =
          '<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">';

        node = document.createElement("body");
        node.innerHTML = content;
        //when the node is reshaped ...
        return reshape(node).then((node) => {
          // apply wanted behaviour to the reshaped node ...
          return cache_behaviour(node).then((node) => {
            // put the node in cache and send it back to the getPage() call
            cachePage(url, node);
            return node;
          });
        });
      });
    }
  }

  function renderPage(node) {
    // Replace the entire body content with the fetched node
    document.body = node;
    document.body.style.visibility = "visible";
  }

  function navigate(url) {
    getPage(url).then((node) => {
      renderPage(node);
    });
  }

  return {
    navigate,
    getPage,
  };
})();

const SPACachePDF = (function () {
  const PDFcache = {};

  function fetchPDF(url) {
    return fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.blob().then((blob) => {
          return blobToBase64(blob).then((base64) => {
            PDFnode = document.createElement("body");
            PDFnode.innerHTML =
              '<embed name="pdf-embed" internalid="pdf-embed" style="position: fixed;left:0px;top:50px;height:1020px;" width=100% type="application/pdf" src="about:blank">';
            PDFnode.querySelectorAll("embed")[0].src =
              URL.createObjectURL(blob);
            //PDFnode.querySelectorAll("embed")[0].src = url;

            /*PDFnode.querySelectorAll("embed")[0].src =
              "data:application/pdf;base64,JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG9pbnQKPDwKICAvVHlwZSAvQ2F0YWxvZwogIC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKCjIgMCBvYmoKPDwKICAvVHlwZSAvUGFnZXMKICAvTWVkaWFCb3ggWyAwIDAgMjAwIDIwMCBdCiAgL0NvdW50IDEKICAvS2lkcyBbIDMgMCBSIF0KPj4KZW5kb2JqCgozIDAgb2JqCjw8CiAgL1R5cGUgL1BhZ2UKICAvUGFyZW50IDIgMCBSCiAgL1Jlc291cmNlcyA8PAogICAgL0ZvbnQgPDwKICAgICAgL0YxIDQgMCBSIAogICAgPj4KICA+PgogIC9Db250ZW50cyA1IDAgUgo+PgplbmRvYmoKCjQgMCBvYmoKPDwKICAvVHlwZSAvRm9udAogIC9TdWJ0eXBlIC9UeXBlMQogIC9CYXNlRm9udCAvVGltZXMtUm9tYW4KPj4KZW5kb2JqCgo1IDAgb2JqICAlIHBhZ2UgY29udGVudAo8PAogIC9MZW5ndGggNDQKPj4Kc3RyZWFtCkJUCjcwIDUwIFRECi9GMSAxMiBUZgooSGVsbG8sIHdvcmxkISkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDEwIDAwMDAwIG4gCjAwMDAwMDAwNzkgMDAwMDAgbiAKMDAwMDAwMDE3MyAwMDAwMCBuIAowMDAwMDAwMzAxIDAwMDAwIG4gCjAwMDAwMDAzODAgMDAwMDAgbiAKdHJhaWxlcgo8PAogIC9TaXplIDYKICAvUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNDkyCiUlRU9G");*/

            return reshapePDF(PDFnode).then((node) => {
              return PDFnode;
            });
          });
        });
      })
      .catch((error) => {
        console.error("Error fetching PDF:", error);
      });
  }

  function cachePDF(url, node) {
    PDFcache[url] = node;
  }

  function getPDF(url) {
    if (PDFcache[url]) {
      return Promise.resolve(PDFcache[url]);
    } else {
      return fetchPDF(url).then((node) => {
        cachePDF(url, node);
        return node;
      });
    }
  }

  function displayPDF(node) {
    document.body = node;
  }

  function loadPDF(url) {
    getPDF(url).then((node) => {
      displayPDF(node);
    });
  }

  return {
    loadPDF,
  };
})();

cache_behaviour = function (node) {
  return new Promise((resolve) => {
    waitForElm(node, ".tabs_horaires a").then((elm) => {
      function linkPointsToCache(link, url) {
        link.addEventListener("click", function (e) {
          SPACache.navigate(url);
          e.preventDefault();
          e.stopPropagation();
        });
      }

      // change links behaviour so that they point to cache
      [
        "/se-deplacer/horaires",
        "/se-deplacer/horaires/metro",
        "/se-deplacer/horaires/tad",
        "/se-deplacer/horaires/navettes",
        "/se-deplacer/horaires/scolaires",
      ].forEach(function callback(url, index) {
        link = node.querySelectorAll(".tabs_horaires a")[index];
        linkPointsToCache(link, url);
      });

      // make all rows click redirect to the pdf column (5th) target
      node.querySelectorAll(".table tbody tr").forEach((el) => {
        var target = el.querySelectorAll("td:nth-child(5) a")[0].href;
        el.onclick = function (e) {
          e.preventDefault();
          e.stopPropagation();
          //https_target = "https" + target.substring(4);

          //SPACachePDF.loadPDF(https_target);
          SPACachePDF.loadPDF(target);

          //location.href = https_target;
        };
      });
    });
    resolve(node);
  });
};

async function my_cache() {
  SPACache.getPage("/se-deplacer/horaires");
  SPACache.getPage("/se-deplacer/horaires/metro");
  SPACache.getPage("/se-deplacer/horaires/tad");
  SPACache.getPage("/se-deplacer/horaires/navettes");
  SPACache.getPage("/se-deplacer/horaires/scolaires");
}

// show print and back button when showing specific line pdf
reshapePDF = function (page) {
  return new Promise((resolve) => {
    waitForElm(page, "embed").then((elm) => {
      //alert("show print and back button when showing specific line pdf")
      elm.style.position = "fixed";
      elm.style.top = "50px";
      elm.style.height = "1020px";

      //b = document.querySelectorAll("body")[0];
      page.style.backgroundColor = "#ebebeb";
      page.style.margin = "20px";

      var sheet = document.createElement("style");
      sheet.innerHTML =
        "a.tab {border-radius: 5px;text-decoration: none;color: #fff; background-color: #ff6600;font-size: 26px;  line-height: 0.5;position: relative;margin: 10px;  padding: 5px 15px;font-family: Arimo,Arial,Helvetica Neue,Helvetica,sans-serif;} a.tab:focus{color:#fff;background-color:rgba(255,102,0,0.5);}";
      page.appendChild(sheet);

      var a = document.createElement("a");
      var linkText = document.createTextNode("Retour aux fiches horaires");
      a.appendChild(linkText);
      a.onclick = function (e) {
        SPACache.navigate("/se-deplacer/horaires");
        //reshape(document);
        e.preventDefault();
        e.stopPropagation();
        //cache_behaviour(document);
      };
      a.classList.add("tab");

      var a2 = document.createElement("a");
      var linkText2 = document.createTextNode("Imprimer");
      a2.appendChild(linkText2);
      a2.href = 'javascript:if(window.print)window.frames["pdf-embed"].print()';
      a2.classList.add("tab");

      page.insertBefore(a, elm);
      page.insertBefore(a2, elm);

      page.style.visibility = "visible";
    });
    resolve(page);
  });
};

document.addEventListener("DOMContentLoaded", (event) => {
  my_cache();
  SPACache.navigate("/se-deplacer/horaires");
});

//autodeploy ???
