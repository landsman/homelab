Feature: Getting around from the home page

  The home page is the name and three sentences; the menu at its foot is the
  way on — to what I take on, to the CV, to the way to reach me — and every
  page leads back.

  Scenario: From the home page to the CV and back
    Given I am on the home page
    When I follow "CV"
    Then I see the heading "Experience"
    When I follow "Back"
    Then I see the heading "Hello there!"
