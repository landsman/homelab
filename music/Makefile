.PHONY: build

# The web app lives in the music repo, checked out here as the app/ submodule
# (`git submodule update --init` after a fresh clone). Supabase stays there.
WEB := app/src/web

# The site into app/src/web/dist — what gets deployed. Needs
# VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the environment.
build:
	cd $(WEB) && deno run compile && deno task build
