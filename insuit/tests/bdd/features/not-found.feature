Feature: Landing on an address that is no page

  An old or mistyped link lands on a page that says so and leads home, rather
  than on an error from the server.

  Scenario: A mistyped address leads home
    Given I open an address that is no page
    Then I see the heading "Nothing here"
    When I follow "Go to the homepage"
    Then I see the heading "Hello there!"
