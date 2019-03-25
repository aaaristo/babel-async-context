const template = require("@babel/template").default;
const wrapFunction = require("@babel/helper-wrap-function").default;

const asyncToGenerator = template(`
  function* getAsyncContext(entryPoint) {
      return yield entryPoint ? { ctxRequest: true } : { ctxCallerRequest: true };
  }

  function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg, ctx, p) {
    try {
      var info = gen[key](arg);
      var value = info.value;
    } catch (error) {
      reject(error);
      return;
    }

    // console.log('asyncGeneratorStep', key, arg, ''+arg, info);

    if (info.done) {
      resolve(value);
    } else if (value.next) {
      const info = value.next();

      // console.log('qui', info);
      if (info.value.ctxRequest) {
          _next(value.next(ctx).value);
      } else if (info.value.ctxCallerRequest) {
        if (p._asyncToGeneratorContext) {
          _next(value.next(p._asyncToGeneratorContext).value);
        } else {
          p.onYield = () => _next(value.next(p._asyncToGeneratorContext).value);
        }
      }
    } else {
      if (value._asyncToGenerator) {
        // console.log('value._asyncToGenerator', value._asyncToGenerator);
        value._asyncToGeneratorContext = ctx;
        value.onYield && value.onYield();
      } else if (value._asyncToGeneratorChildPromises) {
          value._asyncToGeneratorChildPromises.forEach(function (p) {
            p._asyncToGeneratorContext = ctx;
          });
      }
      Promise.resolve(value).then(_next, _throw);
    }
  }

  let sid = 0;

  function _asyncToGenerator(fn, iife) {
    const ctx = { id: ++sid };

    return function () {
      var self = this, args = arguments;
      const p = new Promise(function (resolve, reject) {
        var gen = fn.apply(self, args);
        function _next(value) {
          // console.log('get p._asyncToGeneratorContext', p._asyncToGeneratorContext);
          asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value, p._asyncToGeneratorContext || ctx, p);
        }
        function _throw(err) {
          asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err, p._asyncToGeneratorContext || ctx, p);
        }

        setTimeout(() => _next(undefined));
      });

      p._asyncToGenerator = true;

      return p;
    };
  }

  function _asyncToGeneratorPromiseAll(promises) {
    const all = Promise.all(promises);
    all._asyncToGeneratorChildPromises = promises;
    return all;
  }

  function _asyncToGeneratorIIFE(fn) {
     return _asyncToGenerator(fn, true);
  }
`);

const asyncToGeneratorFn = { type: "Identifier", name: "_asyncToGenerator" };

const asyncToGeneratorIIFEFn = {
  type: "Identifier",
  name: "_asyncToGeneratorIIFE"
};

const asyncToGeneratorPromiseAllFn = {
  type: "Identifier",
  name: "_asyncToGeneratorPromiseAll"
};

module.exports = function(api) {
  const t = api.types;

  return {
    name: "transform-async-domain",
    visitor: {
      Program: (path, state) => {
        path.unshiftContainer("body", asyncToGenerator());
      },
      FunctionDeclaration: (path, state) => {
        if (path.node.async) {
          path.node.async = false;
          path.node.generator = true;
          wrapFunction(path, t.cloneNode(asyncToGeneratorFn));
        }
      },
      ArrowFunctionExpression: (path, state) => {
        if (path.node.async) {
          path.node.async = false;
          path.node.generator = true;
          wrapFunction(path, t.cloneNode(asyncToGeneratorIIFEFn));
        }
      },
      AwaitExpression: path => {
        const argument = path.get("argument");
        path.replaceWith(t.yieldExpression(argument.node));
      },
      CallExpression: path => {
        const parent = path.findParent(path => path.isFunctionDeclaration());

        if (
          path.node.callee &&
          path.node.callee.object &&
          path.node.callee.property &&
          path.node.callee.object.name === "Promise" &&
          path.node.callee.property.name === "all" &&
          (!parent || parent.node.id.name !== "_asyncToGeneratorPromiseAll")
        ) {
          path.replaceWith(
            t.CallExpression(asyncToGeneratorPromiseAllFn, path.node.arguments)
          );
        }
      }
    }
  };
};
