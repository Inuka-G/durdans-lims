package com.uom.lims.whatsapp.reply;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class GreetingsTest {

    @Test
    void bareGreetingsInAllThreeLanguagesMatch() {
        assertThat(Greetings.isBareGreeting("Hi")).isTrue();
        assertThat(Greetings.isBareGreeting("hello!!")).isTrue();
        assertThat(Greetings.isBareGreeting("  Hey ")).isTrue();
        assertThat(Greetings.isBareGreeting("ආයුබෝවන්")).isTrue();
        assertThat(Greetings.isBareGreeting("வணக்கம்")).isTrue();
        assertThat(Greetings.isBareGreeting("menu")).isTrue();
        assertThat(Greetings.isBareGreeting("Good Morning")).isTrue();
    }

    @Test
    void realQuestionsNeverMatchEvenWhenTheyStartWithAGreeting() {
        assertThat(Greetings.isBareGreeting("hi, cbc price?")).isFalse();
        assertThat(Greetings.isBareGreeting("hello mage report eka awada")).isFalse();
        assertThat(Greetings.isBareGreeting("FBC test price ?")).isFalse();
        assertThat(Greetings.isBareGreeting("Report status")).isFalse();
        assertThat(Greetings.isBareGreeting(null)).isFalse();
        assertThat(Greetings.isBareGreeting("   ")).isFalse();
    }
}
