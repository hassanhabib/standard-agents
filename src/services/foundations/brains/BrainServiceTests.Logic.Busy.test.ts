import { describe, expect, it } from "vitest";

import { HttpResponseException } from "../../../models/brokers/https/HttpResponseException.js";
import { createBrainServiceTests, createRandomString } from "./BrainServiceTests.js";

// A service that is busy, or briefly down, usually says so with a 429 or a 503 and a number of
// seconds, and is usually fine by the time those seconds pass. Asking once more after the wait it
// named is what a person would do by hand; asking forever is what nobody should.
describe("BrainService busy logic", () => {
  it.each([
    [429, "3", 3_000],
    [503, "120", 30_000],
    [503, null, 2_000],
  ])(
    "ShouldTryOnceMoreAfterWaitingAsToldWhenTheServiceIsBusyAsync (%i, %s)",
    async (status, retryAfter, expectedWait) => {
      // given
      // The wait is what the service said, capped at thirty seconds so a service that says "come
      // back in an hour" is not waited on for an hour, and two seconds when it said nothing.
      const { generatorBrokerMock, timeBrokerMock, brainService } = createBrainServiceTests();
      const answer = createRandomString();

      generatorBrokerMock.generate
        .mockRejectedValueOnce(new HttpResponseException(status, createRandomString(), retryAfter))
        .mockResolvedValueOnce(answer);

      // when
      const actualAnswer = await brainService.generate(createRandomString(), createRandomString());

      // then
      expect(actualAnswer).toBe(answer);
      expect(generatorBrokerMock.generate).toHaveBeenCalledTimes(2);
      expect(timeBrokerMock.delay).toHaveBeenCalledTimes(1);
      expect(timeBrokerMock.delay.mock.calls[0]?.[0]).toBe(expectedWait);
    },
  );
});
