Feature: Reading about a project on the CV

  The CV lists each job's projects as cards. A card opens the project's details
  on the same page, so the reader never loses their place in the CV.

  Background:
    Given I am on the CV

  Scenario: Opening a project
    When I open the project "The Police of the Czech Republic"
    Then I read "New website for the Police of the Czech Republic."

  Scenario: Going back to the CV from the keyboard
    When I open the project "The Police of the Czech Republic"
    And I press "Escape"
    Then no project is open
