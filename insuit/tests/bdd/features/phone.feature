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

  Scenario: A lone Back leaves the theme switch beside it
    Given I am on a phone
    And I am on the home page
    When I follow "Let's talk"
    Then the theme switch sits beside "Back"
