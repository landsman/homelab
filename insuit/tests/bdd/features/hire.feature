Feature: Finding out what I can be hired for

  The home page says who I am; one link away is what I can take on, and from
  there the way to get in touch.

  Scenario: From the home page to the offer
    Given I am on the home page
    When I follow "Hire me"
    Then I see the heading "Rebuild what no longer keeps up"
    And I am offered a link to "Let's talk"
