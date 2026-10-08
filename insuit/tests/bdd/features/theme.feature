Feature: Choosing a light or a dark page

  The page follows the system's theme. The switch on every page
  overrides it, and the choice is kept for the next visit; switching back to
  what the system says drops it, so the page follows the system again.

  Background:
    Given my system prefers a light theme
    And I am on the home page

  Scenario: A dark page stays dark on the next visit
    When I switch to the dark theme
    Then the page is dark
    When I come back to the page
    Then the page is dark

  Scenario: Switching back follows the system again
    When I switch to the dark theme
    And I switch to the light theme
    Then the page follows my system
