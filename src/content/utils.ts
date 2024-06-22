import { SectionDetail, Term, ISectionData } from "./App/App.types"
import { findCourseInfo } from "../workdayApiHelpers/searchHelpers"

async function extractSection(element: Element) {
  const courseLabels = element.parentElement?.querySelectorAll(
    '[data-automation-id="promptOption"]'
  ) // The div with the raw text of the course section data.
  // Checking if course labels exist and there are at least two of them
  if (!courseLabels || courseLabels.length < 2) {
    alert("Title or section details not found")
    return Promise.reject(new Error("Title or section details not found"))
  }

  // Extracting title
  const titleElement = courseLabels[0]
  const title = titleElement.textContent

  // Checking if title is missing
  if (!title) {
    alert("Title not found")
    return Promise.reject(new Error("Title not found"))
  }

  const code = title.slice(0, title.indexOf(" - "))

  const newSectionPromise = findCourseInfo(code)

  return Promise.all([newSectionPromise]).then(([newSection]) => {
    return newSection
  })
}

const parseSectionDetails = (details: string[]): SectionDetail[] => {
  let detailsArr: SectionDetail[] = []

  details.forEach((detail) => {
    const detailParts = detail.split(" | ")
    if (detailParts.length !== 3 && detailParts.length !== 4) {
      alert(JSON.stringify(detailParts))
      alert("Invalid section details format")
    }

    // If length === 4, first item is location (which we don't use).
    if (detailParts.length === 4) detailParts.shift()
    const [daysString, timeRange, dateRange] = detailParts

    let days = daysString.split(" ")
    let [startTime, endTime] = timeRange.split(" - ")

    startTime = convertTo24HourFormat(startTime)
    endTime = convertTo24HourFormat(endTime)

    //Handle the "Fri (Alternate Weeks)" case, or any text that isn't a valid day
    const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri"]

    days = days.reduce<string[]>((acc, str) => {
      const firstThreeChars = str.substring(0, 3)

      if (daysOfWeek.includes(firstThreeChars)) {
        acc.push(firstThreeChars)
      }

      return acc
    }, [])

    //@TODO: Change for summer term support
    let term = dateRange.includes("2024") ? Term.winterOne : Term.winterTwo
    if (dateRange.includes("2024") && dateRange.includes("2025")) {
      // Case where only one section detail but two term course. Set this term to W1 and push a copy modified to be term 2
      term = Term.winterOne
      detailsArr.push({
        term: Term.winterTwo,
        days: days,
        startTime: startTime,
        endTime: endTime,
        dateRange: dateRange,
      })
    }

    detailsArr.push({
      term: term,
      days: days,
      startTime: startTime,
      endTime: endTime,
      dateRange: dateRange,
    })
  })

  //Removing duplicates, some are from reading week split on workday
  const removeDuplicates = (arr: SectionDetail[]) => {
    const seen = new Set()
    return arr.filter((item) => {
      const serializedItem = JSON.stringify(item)
      return seen.has(serializedItem) ? false : seen.add(serializedItem)
    })
  }

  // Remove duplicates
  detailsArr = removeDuplicates(detailsArr)

  return detailsArr
}

function isCourseFormatted(courseName: string) {
  const regexV = /^[A-Z]{3}_V [0-9]+-[0-9]+$/
  const regexO = /^[A-Z]{3}_O [0-9]+-[0-9]+$/

  return regexV.test(courseName) || regexO.test(courseName)
}

// Convert times from 12-hour format to 24-hour format
const convertTo24HourFormat = (time: string): string => {
  const [timePart, period] = time.split(" ")
  // eslint-disable-next-line prefer-const
  let [hours, minutes] = timePart.split(":").map(Number)

  if (period && period.toLowerCase() === "p.m." && hours !== 12) {
    hours += 12
  } else if (period && period.toLowerCase() === "a.m." && hours === 12) {
    hours = 0
  }

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`
}

const getTermFromSectionDetailsString = (
  sectionDetailsArray: string[]
): Term => {
  //If the string includes 2024, check if it includes 2025 also, if it does then it is both W1 and W2, if only 2024, W1, else W2
  //@TODO: In future this also needs to work for summer terms. Perhaps switch from year based to month based to work for every year
  let includes2024 = false
  let includes2025 = false
  sectionDetailsArray.forEach((detail) => {
    includes2024 = includes2024 || detail.includes("2024")
    includes2025 = includes2025 || detail.includes("2025")
  })
  if (includes2024 && includes2025) return Term.winterFull
  if (includes2024) return Term.winterOne
  return Term.winterTwo
}

const filterSectionsByWorklist = (
  sections: ISectionData[],
  worklist: number
): ISectionData[] => {
  const sectionsForWorklist: ISectionData[] = []
  for (const section of sections) {
    if (section.worklistNumber === worklist) {
      sectionsForWorklist.push(section)
    }
  }
  return sectionsForWorklist
}

const versionOneFiveZeroUpdateNotification = () => {
  const currentVersion = chrome.runtime.getManifest().version
  chrome.storage.local
    .get("versionOneFiveZeroNotificationDisplayed")
    .then((retrievedFlag) => {
      const flag =
        retrievedFlag?.versionOneFiveZeroNotificationDisplayed ?? false
      if (!flag && currentVersion === "1.5.1") {
        alert(
          "Welcome to version 1.5.0! This update includes many changes and a full changelog can be viewed on our communication platforms. Please note that for the best results, it is recommended to sign out and then sign back in as well as exporting all of your worklists and them importing them back in to ensure all features are working correctly. Thank you for using the Workday Extension!"
        )
        chrome.storage.local.set({
          versionOneFiveZeroNotificationDisplayed: true,
        })
      }
    })
    .catch((error) => console.error("Error retrieving flag:", error))
}

export {
  extractSection,
  parseSectionDetails,
  isCourseFormatted,
  convertTo24HourFormat,
  getTermFromSectionDetailsString,
  filterSectionsByWorklist,
  versionOneFiveZeroUpdateNotification,
}
