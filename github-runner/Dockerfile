ARG BASE_IMAGE=myoung34/github-runner:2.335.1
FROM ${BASE_IMAGE}

# Add Node.js 22 (for npx / sentry-cli) + postgresql-client (for psql vault upsert) + shellcheck (for shell linting in `make qa`)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs postgresql-client shellcheck && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Add Deno
RUN curl -fsSL https://deno.land/install.sh | sh -s -- --no-modify-path && \
    mv /root/.deno/bin/deno /usr/local/bin/deno

# Add Supabase CLI (ARM64 binary)
RUN SUPABASE_VERSION=$(curl -fsSL https://api.github.com/repos/supabase/cli/releases/latest \
      | grep '"tag_name"' | sed 's/.*"v\([^"]*\)".*/\1/') && \
    curl -fsSL "https://github.com/supabase/cli/releases/latest/download/supabase_linux_arm64.tar.gz" \
      | tar -xz -C /usr/local/bin supabase && \
    chmod +x /usr/local/bin/supabase
