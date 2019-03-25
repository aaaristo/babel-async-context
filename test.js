async function bar(p) {
  console.log("bar");
  const ctx = await getAsyncContext();
  console.log("bar2");
  console.log(p + " " + ctx.my);
}

async function foo() {
  console.log("foo");
  const x = bar("1");
  await bar("2");
  await x;
  await Promise.all([bar("4"), bar("5")]);
}

(async () => {
  const ctx = await getAsyncContext(true);
  ctx.my = "ciao";
  await foo();
})().catch(x => console.log(x));
