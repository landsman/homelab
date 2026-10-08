Feature: Reading on a phone

  A phone has no height to spare and no room beside the menu. Going from one
  page to the next leaves the heading where it was, so the page does not jump;
  the theme switch goes wherever the menu leaves it room.

  Scenario: The heading stays put from page to page
    Given I am on a phone
    And I am on the home page
    And I note where the heading starts
    When I follow "CV"
    Then the heading starts where it did
    When I follow "Back"
    And I follow "Let's talk"
    Then the heading starts where it did

  Scenario: The home page's menu keeps one row
    Given I am on a phone
    And I am on the home page
    Then the menu's links share one row
    And the theme switch sits beneath the menu

  Scenario: The menu holds still while the page loads
    Given I am on a phone
    And the page's script arrives late
    And I am on the home page
    When the page is ready
    Then the menu has not moved

  Scenario: A lone Back leaves the theme switch beside it
    Given I am on a phone
    And I am on the home page
    When I follow "Let's talk"
    Then the theme switch sits beside "Back"

  Scenario: The way to reach me sits in the middle of the screen
    Given I am on a phone
    And I am on the home page
    When I follow "Let's talk"
    Then I see the heading "Let's talk"
    And the page's few lines sit in the middle under its heading
