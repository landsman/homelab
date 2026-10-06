import { createFileRoute } from "@tanstack/react-router";
import { pageMeta } from "@/app/page-meta";
import { ROUTES } from "@/app/routes";
import { loadPost } from "@/features/blog/posts";
import { PostPage } from "@/features/blog/post-page";
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/blog_/$slug")({
  loader: ({ params }) => loadPost(params.slug),
  // No post, no data: the root's "page not found" tags stay.
  head: ({ loaderData: post }) =>
    post
      ? {
          meta: pageMeta({
            title: m.blog_post_title({ title: post.title }),
            description: post.description,
            path: `${ROUTES.blog}/${post.slug}`,
            type: "article",
          }),
        }
      : {},
  component: () => <PostPage post={Route.useLoaderData()} />,
});
