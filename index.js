const Router = require("cloudworker-router");

const router = new Router();

router.post("/", async (ctx) => {
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
        ctx.body = JSON.stringify({ message: "bad request", params: ["id"] });
        ctx.response.headers = {
            "Content-Type": "application/json",
        };
        ctx.status = 413;
        return;
    }

    const id = generateID();

    // Upload the
    await PASTES.put(id, body, { expirationTtl: 60 * 60 * 24 });

    ctx.body = JSON.stringify({ id });
    ctx.response.headers = {
        "Content-Type": "application/json",
    };
    ctx.status = 200;
});

router.get("/:id", async (ctx) => {
    const id = ctx.params.id;

    if (id.length !== idLength) {
        ctx.body = JSON.stringify({ message: "bad request", params: [ "id" ] });
        ctx.response.headers = {
            "Content-Type": "application/json",
        };
        ctx.status = 400;
        return;
    }

    const value = await PASTES.get(id);
    if (value === null) {
        ctx.body = JSON.stringify({ message: "resource does not exist" });
        ctx.response.headers = {
            "Content-Type": "application/json",
        };
        ctx.status = 404;
        return;
    }

    ctx.body = value;
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
