Feature: Finding where to reach me

  The home page says who I am in three sentences; the way to get in touch is
  one link away.

  Scenario: From the home page to my profiles
    Given I am on the home page
    When I follow "Let's talk"
    Then I am offered a link to "GitHub"
    And I am offered a link to "LinkedIn"
