const CACHE_NAME = "college-control-center-v10";
const APP_ROOT = new URL("./", self.registration.scope);
const APP_FILES = [
	"./",
	"index.html",
	"style.css",
	"app.js",
	"manifest.json",
	"favicon.svg",
	"icon-192.png",
	"icon-512.png",
	"social-preview.png",
].map((path) => new URL(path, APP_ROOT).href);

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME)
			.then((cache) => cache.addAll(APP_FILES))
			.then(() => self.skipWaiting()),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys()
			.then((cacheNames) => Promise.all(
				cacheNames
					.filter((cacheName) => cacheName.startsWith("college-control-center-") && cacheName !== CACHE_NAME)
					.map((cacheName) => caches.delete(cacheName)),
			))
			.then(() => self.clients.claim()),
	);
});

self.addEventListener("fetch", (event) => {
	const requestUrl = new URL(event.request.url);
	if (event.request.method !== "GET" || requestUrl.origin !== APP_ROOT.origin) return;
	if (!requestUrl.pathname.startsWith(APP_ROOT.pathname)) return;

	const responsePromise = event.request.mode === "navigate"
		? fetch(event.request)
			.then(async (response) => {
				if (!response.ok) return response;
				const cache = await caches.open(CACHE_NAME);
				await cache.put(event.request, response.clone());
				return response;
			})
			.catch(async () => {
				const cachedPage = await caches.match(event.request);
				return cachedPage || caches.match(new URL("index.html", APP_ROOT).href);
			})
		: caches.match(event.request)
			.then((cachedResponse) => cachedResponse || fetch(event.request)
				.then(async (response) => {
					if (!response.ok) return response;
					const cache = await caches.open(CACHE_NAME);
					await cache.put(event.request, response.clone());
					return response;
				}));

	event.respondWith(responsePromise);
});
