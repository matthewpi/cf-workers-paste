const Router = require("cloudworker-router");

const router = new Router();

router.post("/documents", async (ctx) => {
    const body = await ctx.event.request.text();

    // Check if there is no request body.
    if (body === "") {
        ctx.body = JSON.stringify({ message: "missing request body" });
        ctx.response.headers = {
            "Content-Type": "application/json",
        };
        ctx.status = 400;
        return;
    }

    // Check if the request body is bigger than 20 KiB.
    if (body.length > (20 * 1024)) {
        ctx.body = JSON.stringify({ message: "payload too large" });
        ctx.response.headers = {
            "Content-Type": "application/json",
        };
        ctx.status = 413;
        return;
    }

    // Get the editor mode.
    let mode = "";
    if ("mode" in ctx.request.query) {
        mode = ctx.request.query.mode;
    }
    if (mode === "") {
        mode = "text/plain";
    }

    const id = generateID();

    // Set the paste into Workers KV.
    await PASTES.put(id, mode + "\n\n\n" + body, { expirationTtl: 60 * 60 * 24 });

    ctx.body = JSON.stringify({ id });
    ctx.response.headers = {
        "Content-Type": "application/json",
        "x-codemirror-mode": mode,
    };
    ctx.status = 200;
});

router.get("/documents/:id", async (ctx) => {
    const id = ctx.params.id;

    if (id.length !== idLength) {
        ctx.body = JSON.stringify({ message: "bad request", params: [ "id" ] });
        ctx.response.headers = {
            "Content-Type": "application/json",
        };
        ctx.status = 400;
        return;
    }

    // Get the paste from Workers KV.
    const value = await PASTES.get(id);
    if (value === null) {
        ctx.body = JSON.stringify({ message: "resource does not exist" });
        ctx.response.headers = {
            "Content-Type": "application/json",
        };
        ctx.status = 404;
        return;
    }

    let mode;
    if ("mode" in ctx.request.query) {
        mode = ctx.request.query.mode;
    } else {
        mode = "";
    }

    switch (mode) {
    case "body":
        ctx.body = value;
        ctx.response.headers = {
            "Content-Type": "text/plain",
        };
        break;

    default:
        const i = value.indexOf("\n\n\n");
        const splits = [value.slice(0, i), value.slice(i + "\n\n\n".length)];

        ctx.body = splits[1];
        ctx.response.headers = {
            "Content-Type": "text/plain",
            "x-codemirror-mode": splits[0],
        };
        break;
    }

    ctx.status = 200;
});

addEventListener("fetch", (e) => {
    e.respondWith(router.resolve(e));
});

const idLength = 16;
const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function generateID() {
    let text = '';

    for (let i = 0; i < idLength; i++) {
        const index = Math.floor(Math.random() * characters.length);
        text += characters.charAt(index);
    }

    return text;
}
