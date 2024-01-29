// TODO :
// resolve race condition : navigate should return a promise (DONE)
// and we should use a callback to show pdf when fully loaded (DONE)
// Tidy up spinner logic coupling, get it out of the pdf reshape if possible
// factorize spinner
// css ize instead of inline style ?
// (=> with callbacks) generalize navigation (through router ?) / page look transformation (reshape) / page behaviour transformation (cache_behaviour)

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

const tisseo_links = [
  "/se-deplacer/horaires",
  "/se-deplacer/horaires/metro",
  "/se-deplacer/horaires/tad",
  "/se-deplacer/horaires/navettes",
  "/se-deplacer/horaires/scolaires",
];

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
        //only reshape tisseo pages
        if (tisseo_links.includes(url)) {
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
        }
        node = document.createElement("body");
        node.innerHTML = content;
        return node;
      });
    }
  }

  function renderPage(node) {
    // Replace the entire body content with the fetched node
    document.body = node;
    document.body.style.visibility = "visible";
  }

  function navigate(url) {
    return new Promise((resolve) => {
      //show_spinner().then(() => {
      getPage(url).then((node) => {
        renderPage(node);
        resolve();
        //});
      });
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
              '<embed  name="pdf-embed" internalid="pdf-embed" style="position: fixed;left:0px;top:50px;height:1020px;" width=100% type="application/pdf" src="about:blank">';
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
    ///bad strong coupling with pdf reshape
    //node.style.visibility = "collapse";
    /*node.childNodes.forEach(function callback(child_node) {
        //child_node.style.visibility = "visible";
        //console.log(child_node);
        document.body.appendChild(child_node);
      });*/
    document.body = node;
    /*document.querySelector("embed").onload = function () {
        //document.getElementById("loading").remove();
        document.body.style.visibility = "visible";
        document.querySelector("div").style.visibility = "visible";
      };*/
    /*SPACache.getPage("/client/spinner.html").then((spinner) => {
      spinner.childNodes.forEach(function callback(child_node) {
        child_node.style.visibility = "visible";
        document.body.appendChild(child_node);
      });
    });*/
    /*document.body.appendChild(
        Promise.resolve(SPACache.getPage("/client/spinner.html")),
      );*/
  }

  function loadPDF(url) {
    //document.body.innerHTML =
    //'<div style="margin: 0;position: absolute;top: 300px;left: 50%;-ms-transform: translate(-50%, -50%);transform: translate(-50%, -50%);" id="spinner"></div>';
    //var target = document.getElementById("spinner");
    //var spinner = new Spinner().spin(target);
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
          //e.stopPropagation();
        });
      }

      // change links behaviour so that they point to cache
      tisseo_links.forEach(function callback(url, index) {
        link = node.querySelectorAll(".tabs_horaires a")[index];
        linkPointsToCache(link, url);
      });

      // make all rows click redirect to the pdf column (5th) target
      node.querySelectorAll(".table tbody tr").forEach((el) => {
        var target = el.querySelectorAll("td:nth-child(5) a")[0].href;
        el.onclick = function (e) {
          e.preventDefault();
          //e.stopPropagation();
          //https_target = "https" + target.substring(4);

          //SPACachePDF.loadPDF(https_target);
          //SPACache.navigate("/client/spinner.html").then(() => {
          SPACachePDF.loadPDF(target);
          //});
          //SPACachePDF.loadPDF(target);

          //location.href = https_target;
        };
      });
    });
    resolve(node);
  });
};

async function my_cache() {
  tisseo_links.forEach(function callback(url) {
    SPACache.getPage(url);
  });
}

// show print and back button when showing specific line pdf
reshapePDF = function (page) {
  return new Promise((resolve) => {
    waitForElm(page, "embed").then((elm) => {
      //alert("show print and back button when showing specific line pdf")
      elm.style.position = "fixed";
      elm.style.top = "50px";
      elm.style.height = "1020px";

      var a = document.createElement("a");
      var a2 = document.createElement("a");
      var d = document.createElement("div");
      /*elm.onload = function () {
        ///bad strong coupling

        document.getElementById("loading").remove();
        document.body.style.visibility = "visible";
        d.style.visibility = "visible";
      };*/

      page.style.backgroundColor = "#ebebeb";
      page.style.margin = "20px";

      var sheet = document.createElement("style");
      sheet.innerHTML =
        "a.tab {border-radius: 5px;text-decoration: none;color: #fff; background-color: #ff6600;font-size: 26px;  line-height: 0.5;position: relative;margin: 10px;  padding: 5px 15px;font-family: Arimo,Arial,Helvetica Neue,Helvetica,sans-serif;} a.tab:focus{color:#fff;background-color:rgba(255,102,0,0.5);}";
      page.appendChild(sheet);

      var linkText = document.createTextNode("Retour aux fiches horaires");
      a.appendChild(linkText);
      a.onclick = function (e) {
        SPACache.navigate("/se-deplacer/horaires");
        //reshape(document);
        e.preventDefault();
        //e.stopPropagation();
        //cache_behaviour(document);
      };
      a.classList.add("tab");

      var linkText2 = document.createTextNode("Imprimer");
      a2.appendChild(linkText2);
      a2.href = 'javascript:if(window.print)window.frames["pdf-embed"].print()';
      a2.classList.add("tab");

      //d.style.visibility = "collapse";
      page.insertBefore(d, elm);
      d.appendChild(a);
      d.appendChild(a2);
      //page.insertBefore(a, elm);
      //page.insertBefore(a2, elm);

      //b = document.querySelectorAll("body")[0];
    });
    resolve(page);
  });
};

window.addEventListener("load", (event) => {
  SPACache.navigate("/client/spinner.html").then(() => {
    my_cache();
    SPACache.navigate("/se-deplacer/horaires");
  });
});
//my_cache();
//SPACache.navigate("/se-deplacer/horaires");
//var target = document.getElementById("spinner");
//var spinner = new Spinner().spin(target);
