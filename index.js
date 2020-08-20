const Router = require("cloudworker-router");

const corsHeader = {
    "Access-Control-Allow-Origin":   "*",
    "Access-Control-Allow-Methods":  "GET, HEAD, POST, OPTIONS",
    "Access-Control-Allow-Headers":  "Content-Type, X-CodeMirror-Mode",
    "Access-Control-Expose-Headers": "X-CodeMirror-Mode",
};

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

    // Get the editor mode from the "X-CodeMirror-Mode" header.
    let mode = "";
    if (ctx.event.request.headers.has("X-CodeMirror-Mode")) {
        mode = ctx.event.request.headers.get("X-CodeMirror-Mode");
    }
    if (mode === "") {
        mode = "text/plain";
    }

    const id = generateID();

    // Set the paste into Workers KV.
    await PASTES.put(id, mode + "\n\n\n" + body, { expirationTtl: 60 * 60 * 24 });

    ctx.body = JSON.stringify({ id, mode });
    ctx.response.headers = {
        "Content-Type":      "application/json",
        "X-CodeMirror-Mode": mode,
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

    const i = value.indexOf("\n\n\n");
    const splits = [ value.slice(0, i), value.slice(i + "\n\n\n".length) ];

    ctx.body = splits[1];
    ctx.response.headers = {
        "Content-Type":      "text/plain",
        "X-CodeMirror-Mode": splits[0],
    };

    ctx.status = 200;
});

addEventListener("fetch", (e) => {
    e.respondWith(handleRequest(e));
});

async function handleRequest(e) {
    const r = e.request;

    switch (r.method) {
    case "OPTIONS":
        if (r.headers.get("Origin") === null || r.headers.get("Access-Control-Request-Method") === null || r.headers.get("Access-Control-Request-Headers") === null) {
            return new Response(null, {
                headers: {
                    "Allow": corsHeader["Access-Control-Allow-Headers"],
                },
            });
        }

        return new Response(null, {
            headers: corsHeader,
        });

    case "GET":
    case "HEAD":
    case "POST":
        const response = await router.resolve(e);

        response.headers.set("Access-Control-Allow-Origin", r.headers.get("Origin"));
        response.headers.set("Access-Control-Expose-Headers", corsHeader["Access-Control-Expose-Headers"]);
        response.headers.append("Vary", "Origin");

        return response;

    default:
        return new Response(null, {
            status: 405,
        });
    }
};

const idLength = 16;
const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function generateID() {
    let text = "";

    for (let i = 0; i < idLength; i++) {
        const index = Math.floor(Math.random() * characters.length);
        text += characters.charAt(index);
    }

    return text;
}
