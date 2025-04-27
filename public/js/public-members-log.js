/**
 * Public Members Log
 * Displays the list of registered members and their SOLAR balances
 */
document.addEventListener("DOMContentLoaded", function () {
  const membersLogContainer = document.getElementById("public-members-log");

  if (!membersLogContainer) {
    console.warn("Members log container not found on this page");
    return;
  }

  // Function to update the member count throughout the site
  function updateMemberCount(count) {
    const memberCountElements = document.querySelectorAll(
      ".member-count, #member-count",
    );
    memberCountElements.forEach((element) => {
      element.textContent = count;

      // Add a subtle highlight animation
      element.style.transition = "background-color 0.5s ease";
      const originalColor = window.getComputedStyle(element).backgroundColor;
      element.style.backgroundColor = "rgba(255, 255, 0, 0.3)";
      setTimeout(() => {
        element.style.backgroundColor = originalColor;
      }, 1000);
    });
  }

  // Helper function to format date
  function formatDate(dateString) {
    console.log("Original date string:", dateString);

    // Handle ISO format dates properly, forcing UTC interpretation to avoid timezone issues
    const parts = dateString.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1; // JavaScript months are 0-based
      const day = parseInt(parts[2]);

      // Create date with explicit year, month, day components
      const date = new Date(Date.UTC(year, month, day));
      console.log("Created date object:", date);

      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC", // Ensure UTC interpretation
      });
    }

    // Fallback for non-standard formats
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  // Create member entry element
  function createMemberEntry(member) {
    const entryDiv = document.createElement("div");
    entryDiv.className = "members-log-entry";

    // Format SOLAR with 4 decimal places (showing values like 1.0001)
    // For large numbers (TC-S Solar Reserve), use a more compact format
    let solarFormatted;
    if (member.isReserve || member.totalSolar >= 1000000) {
      // Format large numbers with billion/million notation
      if (member.totalSolar >= 1000000000) {
        solarFormatted =
          (member.totalSolar / 1000000000).toFixed(2) + " Billion";
      } else if (member.totalSolar >= 1000000) {
        solarFormatted = (member.totalSolar / 1000000).toFixed(2) + " Million";
      }
    } else {
      solarFormatted = parseFloat(member.totalSolar).toFixed(4);
    }

    // Format date
    const joinedDate = formatDate(member.joinedDate);

    // For the Solar Reserve, use a distinct appearance
    if (
      member.isReserve ||
      (member.username === "tc-s.reserve" &&
        member.name === "TC-S Solar Reserve")
    ) {
      entryDiv.className = "members-log-entry reserve-entry";
      entryDiv.style.backgroundColor = "#fffbeb"; // Light gold background
      entryDiv.style.border = "1px solid #ffd700"; // Gold border
      entryDiv.style.padding = "12px";
      entryDiv.style.marginBottom = "20px";
      entryDiv.style.borderRadius = "6px";

      entryDiv.innerHTML = `
        <div class="member-name" style="font-size: 1.2em; color: #b8860b; font-weight: bold;">${member.name}</div>
        <div class="member-joined" data-joined-date="${member.joinedDate}" style="font-style: italic;">Genesis Date: ${joinedDate}</div>
        <div class="member-solar" style="font-weight: bold; color: #006400; font-size: 1.1em;">SOLAR: ${solarFormatted}</div>
        <div class="member-notes" style="margin-top: 5px; font-size: 0.9em; color: #666;">${member.notes || "Genesis Reserve Allocation"}</div>
      `;
    } else {
      entryDiv.innerHTML = `
        <div class="member-name">${member.name}</div>
        <div class="member-joined" data-joined-date="${member.joinedDate}">Joined: ${joinedDate}</div>
        <div class="member-solar">SOLAR: ${solarFormatted}</div>
      `;
    }

    return entryDiv;
  }

  // Function to create the members log
  function createMembersLog(members) {
    // Check if we have members data
    if (!members || !Array.isArray(members) || members.length === 0) {
      membersLogContainer.innerHTML = "<p>No members data available</p>";
      return;
    }

    // Update member count display if element exists
    updateMemberCount(members.length);

    // Clear the container
    membersLogContainer.innerHTML = "";

    // Create a wrapper div
    const wrapperDiv = document.createElement("div");
    wrapperDiv.className = "members-log-container";

    // Add a title if needed
    if (!document.querySelector(".members-log-section h2")) {
      const titleElement = document.createElement("h2");
      titleElement.className = "members-log-title";
      titleElement.textContent = "Public Members Log";
      wrapperDiv.appendChild(titleElement);
    }

    // Get only visible, non-anonymous members and exclude hidden members
    let visibleMembers = members.filter(
      (member) =>
        !member.isAnonymous &&
        !member.hidden_from_public &&
        !member.hiddenFromPublic,
    );

    // Hard-code the specific order for the key members
    const sortedMembers = [];

    // Separate special entries
    const placeholderIndex = visibleMembers.findIndex(
      (m) =>
        m.username === "you.are.next" &&
        m.name.toLowerCase().includes("you are next"),
    );

    let placeholder = null;
    if (placeholderIndex !== -1) {
      placeholder = visibleMembers[placeholderIndex];
      // Remove placeholder from visible members array
      visibleMembers = visibleMembers.filter(
        (m) =>
          !(
            m.username === "you.are.next" &&
            m.name.toLowerCase().includes("you are next")
          ),
      );
    }

    // TC-S Solar Reserve should always be at the very top
    const reserve = visibleMembers.find(
      (m) =>
        m.isReserve === true ||
        (m.username === "tc-s.reserve" && m.name === "TC-S Solar Reserve"),
    );

    if (reserve) {
      sortedMembers.push(reserve);
      // Remove from array to avoid duplicates
      visibleMembers = visibleMembers.filter(
        (m) =>
          !(
            m.isReserve === true ||
            (m.username === "tc-s.reserve" && m.name === "TC-S Solar Reserve")
          ),
      );
    }

    // Terry should always be first among regular members (joined April 9)
    const terry = visibleMembers.find((m) => m.name === "Terry D. Franklin");
    if (terry) {
      sortedMembers.push(terry);
      // Remove from array to avoid duplicates
      visibleMembers = visibleMembers.filter(
        (m) => m.name !== "Terry D. Franklin",
      );
    }

    // JF should always be second among regular members (joined April 10)
    const jf = visibleMembers.find((m) => m.name === "JF");
    if (jf) {
      sortedMembers.push(jf);
      // Remove from array to avoid duplicates
      visibleMembers = visibleMembers.filter((m) => m.name !== "JF");
    }

    // Add remaining members sorted by joined date (oldest to newest)
    const otherMembers = visibleMembers.sort((a, b) => {
      return new Date(a.joinedDate) - new Date(b.joinedDate);
    });

    sortedMembers.push(...otherMembers);

    // Add placeholder at the end if it exists
    if (placeholder) {
      sortedMembers.push(placeholder);
    }

    // Create and add each member entry (we've already filtered out anonymous members)
    sortedMembers.forEach((member) => {
      wrapperDiv.appendChild(createMemberEntry(member));
    });

    // Add data refreshed indicator
    const refreshedInfo = document.createElement("div");
    refreshedInfo.className = "data-refreshed-info";
    refreshedInfo.style.fontSize = "0.7rem";
    refreshedInfo.style.color = "#777";
    refreshedInfo.style.textAlign = "right";
    refreshedInfo.style.marginTop = "10px";

    const now = new Date();
    const timeString = now.toLocaleTimeString();
    refreshedInfo.textContent = `Data refreshed: ${timeString}`;

    wrapperDiv.appendChild(refreshedInfo);

    // Add the wrapper to the container
    membersLogContainer.appendChild(wrapperDiv);
  }

  // Try to load from multiple sources with fallbacks
  // Make loadMembers function global so it can be called from other scripts
  window.loadMembers = async function () {
    // Add timestamp to prevent caching
    const timestamp = new Date().getTime();

    // Clear any cached data by forcing a fresh reload
    console.log("Fetching fresh members data...");

    // Force browser to clear its cache for this page
    if ("caches" in window) {
      try {
        const cacheNames = await window.caches.keys();
        await Promise.all(
          cacheNames.map((cacheName) => {
            return caches.delete(cacheName);
          }),
        );
        console.log("Cleared browser caches");
      } catch (e) {
        console.warn("Failed to clear caches:", e);
      }
    }

    // New clean approach with multiple fallbacks
    let members = null;

    // Try loading from API first
    try {
      const randomValue = Math.random().toString(36).substring(2, 15);
      const response = await fetch(
        `/api/members.json?nocache=${timestamp}&random=${randomValue}`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        },
      );

      if (response.ok) {
        members = await response.json();
        console.log(
          "Members data loaded from API:",
          members.length,
          "members found",
        );
      }
    } catch (err) {
      console.warn("API load failed:", err);
    }

    // If API failed, try XMLHttpRequest approach
    if (!members) {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", `/api/members.json?forcereload=${timestamp}`, false); // Synchronous for simplicity
        xhr.setRequestHeader(
          "Cache-Control",
          "no-cache, no-store, must-revalidate",
        );
        xhr.setRequestHeader("Pragma", "no-cache");
        xhr.setRequestHeader("Expires", "0");
        xhr.send(null);

        if (xhr.status === 200) {
          members = JSON.parse(xhr.responseText);
          console.log(
            "Members data loaded via XHR:",
            members.length,
            "members found",
          );
        }
      } catch (err) {
        console.warn("XHR load failed:", err);
      }
    }

    // If both API methods failed, try embedded data
    if (!members) {
      try {
        const randomValue = Math.random().toString(36).substring(2, 15);
        const embeddedResponse = await fetch(
          `/embedded-members?nocache=${timestamp}&random=${randomValue}`,
          {
            method: "GET",
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
              Expires: "0",
            },
          },
        );

        if (embeddedResponse.ok) {
          const text = await embeddedResponse.text();
          // Handle the window.embeddedMembers format
          const startMarker = "window.embeddedMembers = ";
          const endMarker = ";";

          if (text.includes(startMarker)) {
            const jsonStr = text.substring(
              text.indexOf(startMarker) + startMarker.length,
              text.lastIndexOf(endMarker),
            );

            members = JSON.parse(jsonStr);
            console.log(
              "Members data loaded from embedded:",
              members.length,
              "members found",
            );
          }
        }
      } catch (err) {
        console.warn("Embedded data load failed:", err);
      }
    }

    // If all else failed, use default data as last resort
    if (!members) {
      console.log("All data sources failed, using default members data");

      // Hard-coded fallback data with latest values and only public members
      members = [
        {
          id: 1,
          username: "tc-s.reserve",
          name: "TC-S Solar Reserve",
          email: "reserve@thecurrentsee.org",
          joinedDate: "2025-04-07",
          totalSolar: 10000000002,
          totalDollars: 1360000000272000,
          isAnonymous: false,
          lastDistributionDate: "2025-04-26",
          isReserve: true,
          notes: "Genesis Reserve Allocation",
        },
        {
          id: 3,
          username: "terry.franklin",
          name: "Terry D. Franklin",
          joinedDate: "2025-04-09",
          totalSolar: 19.0,
          totalDollars: 2584000,
          isAnonymous: false,
          lastDistributionDate: "2025-04-26",
        },
        {
          id: 4,
          username: "j.franklin",
          name: "JF",
          joinedDate: "2025-04-10",
          totalSolar: 18.0,
          totalDollars: 2448000,
          isAnonymous: false,
          lastDistributionDate: "2025-04-26",
        },
        {
          id: 5,
          username: "davis",
          name: "Davis",
          joinedDate: "2025-04-18",
          totalSolar: 10.0,
          totalDollars: 1360000,
          isAnonymous: false,
          lastDistributionDate: "2025-04-26",
        },
        {
          id: 6,
          username: "miles.franklin",
          name: "Miles Franklin",
          joinedDate: "2025-04-18",
          totalSolar: 10.0,
          totalDollars: 1360000,
          isAnonymous: false,
          lastDistributionDate: "2025-04-26",
        },
        {
          id: 7,
          username: "arden.f",
          name: "Arden F",
          joinedDate: "2025-04-19",
          totalSolar: 9.0,
          totalDollars: 1224000,
          isAnonymous: false,
          lastDistributionDate: "2025-04-26",
        },
        {
          id: 8,
          username: "marissa.hasseman",
          name: "Marissa Hasseman",
          joinedDate: "2025-04-19",
          totalSolar: 9.0,
          totalDollars: 1224000,
          isAnonymous: false,
          lastDistributionDate: "2025-04-26",
        },
        {
          id: 9,
          username: "kim",
          name: "Kim",
          joinedDate: "2025-04-19",
          totalSolar: 9.0,
          totalDollars: 1224000,
          isAnonymous: false,
          lastDistributionDate: "2025-04-26",
        },
        {
          id: 10,
          username: "jeff.elmore",
          name: "Jeff Elmore",
          joinedDate: "2025-04-19",
          totalSolar: 9.0,
          totalDollars: 1224000,
          isAnonymous: false,
          lastDistributionDate: "2025-04-26",
        },
        {
          id: 11,
          username: "liam.mckay",
          name: "Liam McKay",
          joinedDate: "2025-04-19",
          totalSolar: 9.0,
          totalDollars: 1224000,
          isAnonymous: false,
          lastDistributionDate: "2025-04-26",
        },
        {
          id: 12,
          username: "kjm",
          name: "KJM",
          joinedDate: "2025-04-20",
          totalSolar: 8.0,
          totalDollars: 1088000,
          isAnonymous: false,
          lastDistributionDate: "2025-04-26",
        },
        {
          id: 13,
          username: "brianna",
          name: "Brianna",
          joinedDate: "2025-04-20",
          totalSolar: 8.0,
          totalDollars: 1088000,
          isAnonymous: false,
          lastDistributionDate: "2025-04-26",
        },
        {
          id: 14,
          username: "alex",
          name: "Alex",
          joinedDate: "2025-04-21",
          totalSolar: 7.0,
          totalDollars: 952000,
          isAnonymous: false,
          lastDistributionDate: "2025-04-26",
        },
        {
          id: 15,
          username: "kealani.ventura",
          name: "Kealani Ventura",
          joinedDate: "2025-04-21",
          totalSolar: 7.0,
          totalDollars: 952000,
          isAnonymous: false,
          lastDistributionDate: "2025-04-26",
        },
        {
          id: 16,
          username: "john.d",
          name: "John D",
          joinedDate: "2025-04-26",
          totalSolar: 2.0,
          totalDollars: 272000,
          isAnonymous: false,
          lastDistributionDate: "2025-04-26",
        },
        {
          id: 17,
          username: "you.are.next",
          name: "You are next",
          joinedDate: "2025-04-27",
          totalSolar: 1.0,
          totalDollars: 136000,
          isAnonymous: false,
          isPlaceholder: true,
          lastDistributionDate: "2025-04-26",
        },
      ];
    }

    // Create the members log with whatever data we managed to get
    createMembersLog(members);
  };

  // Function to just update the member count without loading the full member log
  window.refreshMemberCount = async function () {
    try {
      // Add timestamp and random value to prevent caching
      const timestamp = new Date().getTime();
      const randomValue = Math.random().toString(36).substring(2, 15);

      const response = await fetch(
        `/api/member-count?nocache=${timestamp}&random=${randomValue}`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        updateMemberCount(data.count);
        return data.count;
      }
    } catch (err) {
      console.warn("Failed to refresh member count", err);
      // If we fail to get the count, try loading full members data instead
      window.loadMembers();
    }
    return 0;
  };

  // Function to periodically check and update member count
  window.startMemberCountUpdater = function (intervalSeconds = 30) {
    // Update immediately
    window.refreshMemberCount();

    // Then set up interval (if not already set)
    if (!window.memberCountInterval) {
      window.memberCountInterval = setInterval(() => {
        window.refreshMemberCount();
      }, intervalSeconds * 1000);

      console.log(
        `Started member count updater, checking every ${intervalSeconds} seconds`,
      );
    }
  };

  // Load the members data
  window.loadMembers();

  // Start member count updater after a short delay
  setTimeout(() => {
    if (typeof window.startMemberCountUpdater === "function") {
      window.startMemberCountUpdater(60); // Check every minute
    }
  }, 5000);
});
