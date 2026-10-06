Feature: Reading the blog before it is announced

  The blog is prepared in the open but not linked from anywhere: whoever has
  the address can read it, and the list leads to every post.

  Scenario: From the list to a post and back
    Given I am on the blog
    When I follow "Hello"
    Then I see the heading "Hello"
    When I follow "All posts"
    Then I see the heading "Posts"
