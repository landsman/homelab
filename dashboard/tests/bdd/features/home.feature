Feature: Finding a service on the home page

  The home page is a grid of shortcuts. The search box narrows it down, and the
  keyboard reaches both the services and the other page.

  Background:
    Given I am on the home page

  Scenario: Narrowing the grid down to one service
    When I search for "reddit"
    Then I see the "Reddit" shortcut
    But I do not see the "Hacker News" shortcut

  Scenario: Searching for something that is not there
    When I search for "no such service"
    Then I am told that nothing matches

  Scenario: Jumping to the status page from the keyboard
    When I press "Shift+Digit2"
    Then I am on the status page
