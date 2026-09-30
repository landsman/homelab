import { useEffect } from "react";

/** Sets the tab's title for as long as the page is shown. */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
