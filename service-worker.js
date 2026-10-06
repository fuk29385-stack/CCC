const CACHE_NAME = "college-control-center-v5";
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

	event.respondWith(
		caches.match(event.request)
			.then((cachedResponse) => cachedResponse || fetch(event.request)
				.then((response) => {
					if (!response.ok) return response;
					const responseCopy = response.clone();
					caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseCopy));
					return response;
				}))
			.catch(async () => {
				if (event.request.mode === "navigate") {
					return caches.match(new URL("index.html", APP_ROOT).href);
				}
				throw new Error(`Не удалось загрузить ресурс ${event.request.url} без подключения к интернету.`);
			}),
	);
});
