Feature: Reading the blog before it is announced

  The blog is prepared in the open but not linked from the menu. A hidden post
  is left out of the list too: whoever has its address can read it.

  Scenario: A hidden post is read by its address, and missing from the list
    Given I open the post "hello"
    Then I see the heading "Hello"
    When I follow "Back"
    Then I see the heading "Posts"
    And I am not offered a link to "Hello"

  Scenario: Checking hidden posts before they are out
    Given I open the blog with "?qa=true"
    When I follow "Hello"
    Then I see the heading "Hello"

  Scenario: A video in a post waits to be played
    Given I open the post "hello"
    Then I am offered a button to play the video

  Scenario: Code in a post is coloured by its language
    Given I open the post "hello"
    Then the code's keywords stand out from the rest of it
