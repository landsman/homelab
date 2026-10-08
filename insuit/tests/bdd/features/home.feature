Feature: Getting around from the home page

  The home page's menu is three links at the foot of the page. On a phone they
  keep one row; the theme switch is less often wanted, so it waits beneath them.

  Scenario: The menu fits a phone
    Given I am on a phone
    And I am on the home page
    Then the menu's links share one row
    And the theme switch sits beneath the menu
